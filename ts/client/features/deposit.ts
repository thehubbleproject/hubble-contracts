import { BytesLike } from "@ethersproject/bytes";
import { ContractTransaction, Event } from "ethers";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { Batch } from "../../commitments";
import { ZERO_BYTES32 } from "../../constants";
import { DeploymentParameters } from "../../interfaces";
import { State } from "../../state";
import { Tree } from "../../tree";
import { computeRoot } from "../../utils";
import { StateStorageEngine } from "../storageEngine";
import { BaseCommitment, ConcreteBatch } from "./base";

interface Subtree {
    root: string;
    states: State[];
}

export class DepositPool {
    private depositLeaves: State[];
    private subtreeQueue: Subtree[];
    constructor(public readonly paramMaxSubtreeSize: number) {
        this.depositLeaves = [];
        this.subtreeQueue = [];
    }

    pushDeposit(encodedState: BytesLike) {
        const state = State.fromEncoded(encodedState);
        this.depositLeaves.push(state);
        if (this.depositLeaves.length >= this.paramMaxSubtreeSize) {
            this.pushSubtree();
        }
    }
    private pushSubtree() {
        const states = this.depositLeaves.slice();
        const root = Tree.merklize(states.map(s => s.hash())).root;
        this.depositLeaves = [];
        this.subtreeQueue.push({ states, root });
    }

    popDepositSubtree(): Subtree {
        const subtree = this.subtreeQueue.shift();
        if (!subtree) throw new Error("no subtre available");
        return subtree;
    }
}

export class DepositCommitment extends BaseCommitment {
    constructor(public stateRoot: BytesLike) {
        super(stateRoot);
    }

    get bodyRoot() {
        return ZERO_BYTES32;
    }

    public toSolStruct() {
        return { stateRoot: this.stateRoot, body: {} };
    }
}

export async function handleNewBatch(
    event: Event,
    rollup: Rollup
): Promise<ConcreteBatch> {
    const ethTx = await event.getTransaction();
    const data = ethTx?.data as string;
    const receipt = await event.getTransactionReceipt();
    const logs = receipt.logs.map(log => rollup.interface.parseLog(log));
    const depositsFinalisedLog = logs.filter(
        log => log.signature == "DepositsFinalised(uint256,bytes32,uint256)"
    )[0];
    const txDescription = rollup.interface.parseTransaction({ data });
    const depositSubtreeRoot = depositsFinalisedLog.args?.depositSubTreeRoot;
    const { vacant } = txDescription.args;

    const stateRoot = computeRoot(
        depositSubtreeRoot,
        vacant.pathAtDepth,
        vacant.witness
    );
    const commitment = new DepositCommitment(stateRoot);
    return new ConcreteBatch([commitment]);
}

export async function submitBatch(
    previousBatch: Batch,
    stateEngine: StateStorageEngine,
    rollup: Rollup,
    params: DeploymentParameters
): Promise<ContractTransaction> {
    const previousCommitmentProof = previousBatch.proofCompressed(
        previousBatch.commitments.length - 1
    );

    const vacancy = await stateEngine.findVacantSubtree(
        params.MAX_DEPOSIT_SUBTREE_DEPTH
    );
    return await rollup.submitDeposits(
        previousCommitmentProof,
        { pathAtDepth: vacancy.path, witness: vacancy.witness },
        { value: params.STAKE_AMOUNT }
    );
}
