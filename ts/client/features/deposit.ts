import { BytesLike } from "@ethersproject/bytes";
import { BigNumber, BigNumberish, ContractTransaction, Event } from "ethers";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { ZERO_BYTES32 } from "../../constants";
import { DeploymentParameters, Vacant } from "../../interfaces";
import { State } from "../../state";
import { MemoryTree } from "../../tree/memoryTree";
import { computeRoot, prettyHex, prettyVacant } from "../../utils";
import { StateStorageEngine, StorageManager } from "../storageEngine";
import { BaseCommitment, ConcreteBatch } from "./base";
import {
    Batch,
    BatchHandlingStrategy,
    BatchPackingCommand,
    OffchainTx
} from "./interface";

interface Subtree {
    id: BigNumber;
    root: string;
    states: State[];
}

const subtreeToString = ({ id, root, states }: Subtree): string => {
    const statesStr = states.join("\n    ");
    return `<Subtree  id ${id}
    root ${prettyHex(root)}
    ${statesStr}
>`;
};

export interface IDepositPool {
    pushDeposit(encodedState: BytesLike): void;
    isSubtreeReady(): boolean;
    popDepositSubtree(): Subtree;
    toString(): string;
}

export class DepositPool implements IDepositPool {
    public readonly maxSubtreeSize: number;
    private depositLeaves: State[];
    private subtreeQueue: Subtree[];
    private currentSubtreeID: BigNumber;

    constructor(maxSubtreeDepth: number) {
        this.maxSubtreeSize = 2 ** maxSubtreeDepth;
        this.depositLeaves = [];
        this.subtreeQueue = [];
        this.currentSubtreeID = BigNumber.from(0);
    }

    public pushDeposit(encodedState: BytesLike) {
        const state = State.fromEncoded(encodedState);
        this.depositLeaves.push(state);
        if (this.depositLeaves.length >= this.maxSubtreeSize) {
            this.pushSubtree();
        }
    }

    public isSubtreeReady(): boolean {
        return !!this.subtreeQueue.length;
    }

    public popDepositSubtree(): Subtree {
        const subtree = this.subtreeQueue.shift();
        if (!subtree) throw new Error("no subtree available");
        return subtree;
    }

    public toString(): string {
        return `<DepositPool leaves ${this.depositLeaves.length} queue ${this.subtreeQueue.length}>`;
    }

    private incrementSubtreeID(): BigNumber {
        this.currentSubtreeID = this.currentSubtreeID.add(1);
        return this.currentSubtreeID;
    }

    private pushSubtree() {
        const states = this.depositLeaves.splice(0, this.depositLeaves.length);
        const root = MemoryTree.merklize(states.map(s => s.hash())).root;
        const id = this.incrementSubtreeID();
        this.subtreeQueue.push({ id, states, root });
    }
}

interface FinalizationContext {
    subtreeID: BigNumber;
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
        log => log.signature === "DepositsFinalised(uint256,bytes32,uint256)"
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
    pool: IDepositPool,
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
    if (!subtree.id.eq(context.subtreeID)) {
        throw new Error(
            `Fatal: mismatched deposit subtree ID. onchain: ${context.subtreeID}  pool: ${subtree.id}`
        );
    }

    await stateEngine.updateBatch(
        context.pathToSubTree,
        params.MAX_DEPOSIT_SUBTREE_DEPTH,
        subtree.states
    );
    await stateEngine.commit();
}

export class DepositHandlingStrategy implements BatchHandlingStrategy {
    constructor(
        private readonly rollup: Rollup,
        private readonly storageManager: StorageManager,
        private readonly params: DeploymentParameters,
        private pool: IDepositPool
    ) {}

    public async parseBatch(event: Event) {
        return await handleNewBatch(event, this.rollup);
    }

    public async processBatch(
        batch: ConcreteBatch<DepositCommitment>
    ): Promise<OffchainTx[]> {
        await applyBatch(
            batch,
            this.pool,
            this.params,
            this.storageManager.state
        );
        return [];
    }
}

export class DepositPackingCommand implements BatchPackingCommand {
    constructor(
        private params: DeploymentParameters,
        private storageManager: StorageManager,
        private pool: IDepositPool,
        private rollup: Rollup
    ) {}

    private async submitDeposits(
        batchID: BigNumberish,
        prevBatch: Batch,
        vacancy: Vacant
    ): Promise<ContractTransaction> {
        const prevCommitProof = prevBatch.proofCompressed(
            prevBatch.commitments.length - 1
        );

        return await this.rollup.submitDeposits(
            batchID,
            prevCommitProof,
            vacancy,
            {
                value: this.params.STAKE_AMOUNT
            }
        );
    }

    public async packAndSubmit(): Promise<ContractTransaction> {
        const { state, batches } = this.storageManager;

        const [nextBatchID, curBatch] = await Promise.all([
            batches.nextBatchID(),
            batches.current()
        ]);
        if (!curBatch) {
            throw new Error("no batches synced");
        }

        const vacancy = await state.findVacantSubtree(
            this.params.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        console.log("Submitting deposits", prettyVacant(vacancy));
        const l1Txn = await this.submitDeposits(nextBatchID, curBatch, vacancy);

        // Update L2 state
        const subtree = this.pool.popDepositSubtree();
        await state.updateBatch(
            vacancy.pathAtDepth,
            this.params.MAX_DEPOSIT_SUBTREE_DEPTH,
            subtree.states
        );
        await state.commit();

        const context = {
            subtreeID: subtree.id,
            depositSubtreeRoot: subtree.root,
            pathToSubTree: vacancy.pathAtDepth
        };

        const commit = new DepositCommitment(state.root, context);
        const depositBatch = new ConcreteBatch([commit]);
        await batches.add(depositBatch, l1Txn);

        return l1Txn;
    }
}
