import { BytesLike } from "@ethersproject/bytes";
import { ContractTransaction, Event } from "ethers";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { Batch } from "../../commitments";
import { ZERO_BYTES32 } from "../../constants";
import { DeploymentParameters } from "../../interfaces";
import { State } from "../../state";
import { Tree } from "../../tree";
import { computeRoot, prettyHex } from "../../utils";
import { StateStorageEngine, StorageManager } from "../storageEngine";
import { BaseCommitment, ConcreteBatch } from "./base";
import { BatchHandlingStrategy, BatchPackingCommand } from "./interface";

interface Subtree {
    root: string;
    states: State[];
}

const subtreeToString = ({ root, states }: Subtree): string => {
    const statesStr = states.join("\n    ");
    return `<Subtree  root ${prettyHex(root)}
    ${statesStr}
>`;
};

export class DepositPool {
    public readonly maxSubtreeSize: number;
    private depositLeaves: State[];
    private subtreeQueue: Subtree[];

    constructor(maxSubtreeDepth: number) {
        this.maxSubtreeSize = 2 ** maxSubtreeDepth;
        this.depositLeaves = [];
        this.subtreeQueue = [];
    }

    public pushDeposit(encodedState: BytesLike) {
        const state = State.fromEncoded(encodedState);
        this.depositLeaves.push(state);
        if (this.depositLeaves.length >= this.maxSubtreeSize) {
            this.pushSubtree();
        }
    }

    public popDepositSubtree(): Subtree {
        const subtree = this.subtreeQueue.shift();
        if (!subtree) throw new Error("no subtree available");
        return subtree;
    }

    public toString(): string {
        return `<DepositPool leaves ${this.depositLeaves.length} queue ${this.subtreeQueue.length}>`;
    }

    private pushSubtree() {
        const states = this.depositLeaves.slice();
        const root = Tree.merklize(states.map(s => s.hash())).root;
        this.depositLeaves = [];
        this.subtreeQueue.push({ states, root });
    }
}

interface FinalizationContext {
    subtreeID: number;
    depositSubtreeRoot: string;
    pathToSubTree: number;
}

export class DepositCommitment extends BaseCommitment {
    constructor(
        public readonly stateRoot: BytesLike,
        public readonly context: FinalizationContext
    ) {
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
): Promise<ConcreteBatch<DepositCommitment>> {
    const ethTx = await event.getTransaction();
    const data = ethTx?.data as string;
    const receipt = await event.getTransactionReceipt();
    const logs = receipt.logs.map(log => rollup.interface.parseLog(log));
    const depositsFinalisedLog = logs.filter(
        log => log.signature == "DepositsFinalised(uint256,bytes32,uint256)"
    )[0];
    const txDescription = rollup.interface.parseTransaction({ data });
    const depositSubtreeRoot = depositsFinalisedLog.args?.depositSubTreeRoot;
    const subtreeID = depositsFinalisedLog.args?.subtreeID;
    const { vacant } = txDescription.args;
    const pathAtDepthNum = vacant.pathAtDepth.toNumber();

    const stateRoot = computeRoot(
        depositSubtreeRoot,
        pathAtDepthNum,
        vacant.witness
    );
    const context: FinalizationContext = {
        subtreeID,
        depositSubtreeRoot,
        pathToSubTree: pathAtDepthNum
    };
    const commitment = new DepositCommitment(stateRoot, context);
    return new ConcreteBatch([commitment]);
}

export async function applyBatch(
    batch: ConcreteBatch<DepositCommitment>,
    pool: DepositPool,
    params: DeploymentParameters,
    stateEngine: StateStorageEngine
) {
    const { context } = batch.commitments[0];
    const subtree = pool.popDepositSubtree();
    if (subtree.root !== context.depositSubtreeRoot) {
        throw new Error(
            `Fatal: mismatched deposit root. onchain: ${context.depositSubtreeRoot}  pool: ${subtree.root}`
        );
    }
    await stateEngine.updateBatch(
        context.pathToSubTree,
        params.MAX_DEPOSIT_SUBTREE_DEPTH,
        subtree.states
    );
    await stateEngine.commit();
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

export class DepositHandlingStrategy implements BatchHandlingStrategy {
    constructor(
        private readonly rollup: Rollup,
        private readonly storageManager: StorageManager,
        private readonly params: DeploymentParameters,
        private pool: DepositPool
    ) {}
    async parseBatch(event: Event) {
        return await handleNewBatch(event, this.rollup);
    }

    async processBatch(batch: ConcreteBatch<DepositCommitment>): Promise<void> {
        return applyBatch(
            batch,
            this.pool,
            this.params,
            this.storageManager.state
        );
    }
}

export class DepositPackingCommand implements BatchPackingCommand {
    async packAndSubmit(): Promise<ContractTransaction> {
        throw new Error("Not implemented");
    }
}
