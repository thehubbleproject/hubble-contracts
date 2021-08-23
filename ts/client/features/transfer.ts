import {
    BigNumber,
    BigNumberish,
    BytesLike,
    ContractTransaction,
    Event
} from "ethers";
import {
    arrayify,
    concat,
    hexlify,
    hexZeroPad,
    keccak256,
    solidityKeccak256,
    solidityPack
} from "ethers/lib/utils";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { aggregate, BlsVerifier, SignatureInterface } from "../../blsSigner";
import { float16 } from "../../decimal";
import { Group } from "../../factory";
import { DeploymentParameters } from "../../interfaces";
import { dumpG1, loadG1, parseG1, solG1 } from "../../mcl";
import { prettyHex, sum, sumNumber } from "../../utils";
import { FeeReceivers } from "../config";
import {
    processReceiver,
    processSender,
    validateReceiver,
    validateSender
} from "../stateTransitions";
import { StateStorageEngine, StorageManager } from "../storageEngine";
import { MultiTokenPool } from "../txPool";
import { BaseCommitment, ConcreteBatch } from "./base";
import {
    SolStruct,
    CompressedTx,
    OffchainTx,
    StateIDLen,
    FloatLength,
    BatchHandlingStrategy,
    BatchPackingCommand,
    FailedOffchainTxWrapper,
    Batch
} from "./interface";

export class TransferCompressedTx implements CompressedTx {
    public readonly txType = "0x01";
    static readonly byteLengths = [
        StateIDLen,
        StateIDLen,
        FloatLength,
        FloatLength
    ];
    constructor(
        public readonly fromIndex: BigNumber,
        public readonly toIndex: BigNumber,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber
    ) {}

    serialize(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), StateIDLen),
            hexZeroPad(hexlify(this.toIndex), StateIDLen),
            float16.compress(this.amount),
            float16.compress(this.fee)
        ]);
        return hexlify(concated);
    }
    static deserialize(bytes: Uint8Array) {
        let position = 0;
        let bytesArray: Uint8Array[] = [];
        const sum = sumNumber(this.byteLengths);
        if (bytes.length != sum) throw new Error("invalid bytes");
        for (const len of this.byteLengths) {
            bytesArray.push(bytes.slice(position, position + len));
            position += len;
        }
        const fromIndex = BigNumber.from(bytesArray[0]);
        const toIndex = BigNumber.from(bytesArray[1]);
        const amount = float16.decompress(bytesArray[2]);
        const fee = float16.decompress(bytesArray[3]);
        return new this(fromIndex, toIndex, amount, fee);
    }

    public message(nonce: BigNumber): string {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.txType,
                this.fromIndex,
                this.toIndex,
                nonce,
                this.amount,
                this.fee
            ]
        );
    }

    public toString(): string {
        return `<TransferCompressed  ${this.fromIndex}->${this.toIndex} $${this.amount}  fee ${this.fee}>`;
    }
}
export class TransferOffchainTx extends TransferCompressedTx
    implements OffchainTx {
    public static fromCompressed(
        compTx: TransferCompressedTx,
        nonce: BigNumber
    ): TransferOffchainTx {
        return new TransferOffchainTx(
            compTx.fromIndex,
            compTx.toIndex,
            compTx.amount,
            compTx.fee,
            nonce
        );
    }

    constructor(
        public readonly fromIndex: BigNumber,
        public readonly toIndex: BigNumber,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: BigNumber,
        public signature?: SignatureInterface
    ) {
        super(fromIndex, toIndex, amount, fee);
    }

    public toCompressed(): TransferCompressedTx {
        return new TransferCompressedTx(
            this.fromIndex,
            this.toIndex,
            this.amount,
            this.fee
        );
    }

    public message(): string {
        return this.toCompressed().message(this.nonce);
    }

    serialize(): string {
        if (!this.signature) throw new Error("Signature must be assigned");
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), StateIDLen),
            hexZeroPad(hexlify(this.toIndex), StateIDLen),
            float16.compress(this.amount),
            float16.compress(this.fee),
            hexZeroPad(hexlify(this.nonce), StateIDLen),
            dumpG1(this.signature?.sol)
        ]);
        return hexlify(concated);
    }

    hash() {
        return keccak256(this.serialize());
    }

    static deserialize(bytes: Uint8Array) {
        const decompress = (input: Uint8Array) => float16.decompress(input);
        const fields = [
            {
                name: "fromIndex",
                length: StateIDLen,
                constructor: BigNumber.from
            },
            {
                name: "toIndex",
                length: StateIDLen,
                constructor: BigNumber.from
            },
            {
                name: "amount",
                length: FloatLength,
                constructor: decompress
            },
            {
                name: "fee",
                length: FloatLength,
                constructor: decompress
            },
            { name: "nonce", length: StateIDLen, constructor: BigNumber.from },
            { name: "signature", length: 64, constructor: hexlify }
        ];
        const sum = sumNumber(fields.map(x => x.length));
        if (bytes.length != sum) throw new Error("invalid bytes");
        const obj: any = {};
        let position = 0;
        for (const field of fields) {
            const byteSlice = bytes.slice(position, position + field.length);
            position += field.length;
            obj[field.name] = field.constructor(byteSlice);
        }
        const solG1 = loadG1(obj.signature);
        const mclG1 = parseG1(solG1);
        const signature = { sol: solG1, mcl: mclG1 };

        return new this(
            obj.fromIndex,
            obj.toIndex,
            obj.amount,
            obj.fee,
            obj.nonce,
            signature
        );
    }

    public toString(): string {
        return `<Transfer ${this.fromIndex}->${this.toIndex} $${this.amount}  fee ${this.fee}  nonce ${this.nonce}>`;
    }
}

type TransactionBundle = {
    acceptedTxs: TransferOffchainTx[];
    failedTxs: FailedOffchainTxWrapper[];
};

export function getAggregateSig(txs: OffchainTx[]): solG1 {
    const signatures = [];
    for (const tx of txs) {
        if (!tx.signature) throw new Error(`tx has no signautre ${tx}`);
        signatures.push(tx.signature);
    }
    return aggregate(signatures).sol;
}

export function compress(txs: OffchainTx[]): string {
    return hexlify(concat(txs.map(tx => tx.toCompressed().serialize())));
}

export class TransferCommitment extends BaseCommitment {
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: solG1,
        public feeReceiver: BigNumber,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }

    static fromTxs(
        txs: TransferOffchainTx[],
        stateRoot: BytesLike,
        accountRoot: BytesLike,
        feeReceiver: BigNumber
    ) {
        const signature = getAggregateSig(txs);
        const compressedTx = compress(txs);
        return new this(
            stateRoot,
            accountRoot,
            signature,
            feeReceiver,
            compressedTx
        );
    }

    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }
    public decompressTxs(): TransferCompressedTx[] {
        const bytes = arrayify(this.txs);
        const txLen = sumNumber(TransferCompressedTx.byteLengths);
        if (bytes.length % txLen != 0) throw new Error("invalid bytes");
        let txs = [];
        for (let i = 0; i < bytes.length; i += txLen) {
            const tx = TransferCompressedTx.deserialize(
                bytes.slice(i, i + txLen)
            );
            txs.push(tx);
        }
        return txs;
    }

    get bodyRoot(): string {
        return solidityKeccak256(
            ["bytes32", "uint256[2]", "uint256", "bytes"],
            [this.accountRoot, this.signature, this.feeReceiver, this.txs]
        );
    }
}

async function validateTransferStateTransition(
    tx: TransferOffchainTx,
    tokenID: BigNumber,
    storage: StorageManager,
    verifier: BlsVerifier
) {
    const sender = await storage.state.get(tx.fromIndex.toNumber());
    const receiver = await storage.state.get(tx.toIndex.toNumber());

    validateSender(sender, tokenID, tx.amount, tx.fee);
    validateReceiver(receiver, tokenID);
    const senderKey = await storage.pubkey.get(sender.pubkeyID.toNumber());
    if (!tx.nonce.eq(sender.nonce))
        throw new Error(`Bad nonce  tx ${tx.nonce}  state ${sender.nonce}`);
    if (!tx.signature) throw new Error("Expect tx to have signature here");
    if (!verifier.verify(tx.signature.sol, senderKey.pubkey, tx.message()))
        throw new Error("Invalid signature");
}

async function processTransfer(
    tx: TransferCompressedTx,
    tokenID: BigNumber,
    engine: StateStorageEngine
): Promise<void> {
    await processSender(tx.fromIndex, tokenID, tx.amount, tx.fee, engine);
    await processReceiver(tx.toIndex, tx.amount, tokenID, engine);
}

async function process(
    commitment: TransferCommitment,
    storageManager: StorageManager,
    params: DeploymentParameters
): Promise<OffchainTx[]> {
    const { state: engine } = storageManager;
    const txs = commitment.decompressTxs();
    if (txs.length > params.MAX_TXS_PER_COMMIT) {
        throw new Error(
            `txs count of ${txs.length} exceeds ${params.MAX_TXS_PER_COMMIT}`
        );
    }

    const feeReceiverID = commitment.feeReceiver;
    const { tokenID } = await engine.get(txs[0].fromIndex.toNumber());

    const offchainTxs = [];
    for (const tx of txs) {
        const { nonce } = await engine.get(tx.fromIndex.toNumber());
        const offchainTx = TransferOffchainTx.fromCompressed(tx, nonce);
        offchainTxs.push(offchainTx);
        await processTransfer(tx, tokenID, engine);
    }
    const fees = sum(txs.map(tx => tx.fee));
    await processReceiver(feeReceiverID, fees, tokenID, engine);
    await engine.commit();
    if (engine.root != commitment.stateRoot)
        throw new Error(
            `Validation failed  expect ${engine.root} got ${commitment.stateRoot}`
        );
    return offchainTxs;
}

/**
 * A pipe of transfer transactions for a token.
 */
export interface TransferPipe {
    source: AsyncGenerator<TransferOffchainTx>;
    tokenID: BigNumber;
    feeReceiverID: BigNumber;
}

async function pack(
    pipe: TransferPipe,
    storageManager: StorageManager,
    params: DeploymentParameters,
    verifier: BlsVerifier
): Promise<{ commit: TransferCommitment } & TransactionBundle> {
    const acceptedTxs: TransferOffchainTx[] = [];
    const failedTxs: FailedOffchainTxWrapper[] = [];

    const engine = storageManager.state;
    const tokenID = pipe.tokenID;

    for await (const tx of pipe.source) {
        if (acceptedTxs.length >= params.MAX_TXS_PER_COMMIT) break;
        try {
            await validateTransferStateTransition(
                tx,
                tokenID,
                storageManager,
                verifier
            );
        } catch (err) {
            console.error(`bad tx ${tx.hash()}  ${err}`);
            failedTxs.push({ tx, err });
            continue;
        }
        await processTransfer(tx, pipe.tokenID, engine);
        acceptedTxs.push(tx);
    }
    if (acceptedTxs.length == 0) throw new Error("No tx has been accepted");
    const fees = sum(acceptedTxs.map(tx => tx.fee));
    await processReceiver(pipe.feeReceiverID, fees, pipe.tokenID, engine);
    await engine.commit();

    const commit = TransferCommitment.fromTxs(
        acceptedTxs,
        engine.root,
        storageManager.pubkey.root,
        pipe.feeReceiverID
    );
    return { commit, acceptedTxs, failedTxs };
}

/**
 * Factory which generates random transactions.
 */
export class OffchainTransferFactory {
    private numTransfers: number = 0;

    constructor(
        public readonly group: Group,
        public readonly storage: StorageManager,
        private readonly maxTransfers?: number
    ) {}

    protected isComplete(): boolean {
        return !!this.maxTransfers && this.numTransfers >= this.maxTransfers;
    }

    async *genTx(tokenID: number): AsyncGenerator<TransferOffchainTx> {
        const { state, transactions } = this.storage;
        while (true) {
            for (const sender of this.group.userIterator()) {
                const { user: receiver } = this.group.pickRandom();
                const receiverStateID = receiver.getStateID(tokenID);
                const senderStateID = sender.getStateID(tokenID);
                const senderState = await state.get(senderStateID);
                const amount = float16.round(senderState.balance.div(10));
                const fee = float16.round(amount.div(10));
                const tx = new TransferOffchainTx(
                    BigNumber.from(senderStateID),
                    BigNumber.from(receiverStateID),
                    amount,
                    fee,
                    senderState.nonce
                );
                tx.signature = sender.signRaw(tx.message());
                yield tx;

                this.numTransfers++;
                await transactions.pending(tx);
            }
        }
    }
}

export class TransferHandlingStrategy implements BatchHandlingStrategy {
    constructor(
        private rollup: Rollup,
        private storageManager: StorageManager,
        private params: DeploymentParameters
    ) {}
    async parseBatch(event: Event): Promise<Batch> {
        const ethTx = await event.getTransaction();
        const data = ethTx?.data as string;
        const accountRoot = event.args?.accountRoot;
        const txDescription = this.rollup.interface.parseTransaction({ data });
        const {
            stateRoots,
            signatures,
            feeReceivers,
            txss
        } = txDescription.args;
        const commitments = [];
        for (let i = 0; i < stateRoots.length; i++) {
            const commitment = new TransferCommitment(
                stateRoots[i],
                accountRoot,
                signatures[i],
                feeReceivers[i],
                txss[i]
            );
            commitments.push(commitment);
        }
        return new ConcreteBatch(commitments);
    }

    async processBatch(
        batch: ConcreteBatch<TransferCommitment>
    ): Promise<OffchainTx[]> {
        return batch.commitments.reduce<Promise<OffchainTx[]>>(
            async (txnsPromise, commitment) => {
                const txns = await txnsPromise;
                const commitTxns = await process(
                    commitment,
                    this.storageManager,
                    this.params
                );
                return [...txns, ...commitTxns];
            },
            Promise.resolve([])
        );
    }
}

/**
 * Pool of pending transfers
 */
export interface ITransferPool {
    /**
     * Returns if the pool is empty.
     *
     * @returns Whether the pool is empty.
     */
    isEmpty(): boolean;
    /**
     * Adds a transfer transaction to the pool.
     *
     * @param tx Transfer transaction to add.
     */
    push(tx: TransferOffchainTx): Promise<void>;
    /**
     * Gets the next pipe of trnsfer transactions to process.
     *
     * @returns Pipe of next transfer transactions.
     */
    getNextPipe(): Promise<TransferPipe>;
}

/**
 * Memory implementation of transfer pool.
 */
export class TransferPool implements ITransferPool {
    private pool: MultiTokenPool<TransferOffchainTx>;

    constructor(
        stateStorage: StateStorageEngine,
        feeRecievers: FeeReceivers,
        maxPendingTransactions?: number
    ) {
        this.pool = new MultiTokenPool(
            stateStorage,
            feeRecievers,
            maxPendingTransactions
        );
    }

    public isEmpty(): boolean {
        return this.pool.size() == 0;
    }

    public async push(tx: TransferOffchainTx) {
        await this.pool.push(tx);
    }

    public async getNextPipe(): Promise<TransferPipe> {
        const {
            tokenID,
            feeReceiverID
        } = await this.pool.getHighestValueToken();
        const source = this.genTx(tokenID);
        return {
            source,
            tokenID,
            feeReceiverID
        };
    }

    public toString(): string {
        return `<TransferPool  size ${this.pool.size()}>`;
    }

    private async *genTx(
        tokenID: BigNumber
    ): AsyncGenerator<TransferOffchainTx> {
        while (this.pool.size(tokenID) > 0) {
            yield this.pool.pop(tokenID);
        }
    }
}

type SimulatorPoolOptions = {
    group: Group;
    storage: StorageManager;
    feeReceivers: FeeReceivers;
    maxTransfers?: number;
};

/**
 * Transfer pool which generates random transactions.
 */
export class SimulatorPool extends OffchainTransferFactory
    implements ITransferPool {
    private readonly feeReceivers: FeeReceivers;

    constructor({
        group,
        storage,
        feeReceivers,
        maxTransfers
    }: SimulatorPoolOptions) {
        super(group, storage, maxTransfers);
        this.feeReceivers = feeReceivers;
    }

    public isEmpty(): boolean {
        return this.isComplete();
    }

    public async push(_tx: TransferOffchainTx): Promise<void> {
        throw new Error("SimulatorPool: push not implemented.");
    }

    public async getNextPipe(): Promise<TransferPipe> {
        const { tokenID, feeReceiverID } = this.getRandomToken();
        const source = this.genTx(tokenID.toNumber());
        return {
            source,
            tokenID,
            feeReceiverID
        };
    }

    private getRandomToken(): { tokenID: BigNumber; feeReceiverID: BigNumber } {
        const idx = Math.floor(Math.random() * this.feeReceivers.length);
        const { tokenID, stateID } = this.feeReceivers[idx];
        return {
            tokenID: BigNumber.from(tokenID),
            feeReceiverID: BigNumber.from(stateID)
        };
    }
}

const MAX_COMMIT_PER_BATCH = 32;

async function packBatch(
    pool: ITransferPool,
    storageManager: StorageManager,
    params: DeploymentParameters,
    verifier: BlsVerifier
): Promise<{ batch: ConcreteBatch<TransferCommitment> } & TransactionBundle> {
    const commitments = [];
    const txBundle: TransactionBundle = {
        acceptedTxs: [],
        failedTxs: []
    };
    for (let i = 0; i < MAX_COMMIT_PER_BATCH; i++) {
        const pipe = await pool.getNextPipe();
        const { commit, acceptedTxs, failedTxs } = await pack(
            pipe,
            storageManager,
            params,
            verifier
        );
        commitments.push(commit);
        txBundle.acceptedTxs.push(...acceptedTxs);
        txBundle.failedTxs.push(...failedTxs);

        if (pool.isEmpty()) {
            break;
        }
    }
    if (commitments.length == 0) throw new Error("The batch has no commitment");
    const batch = new ConcreteBatch(commitments);
    return { ...txBundle, batch };
}

export class TransferPackingCommand implements BatchPackingCommand {
    constructor(
        private params: DeploymentParameters,
        private storageManager: StorageManager,
        private pool: ITransferPool,
        private rollup: Rollup,
        private verifier: BlsVerifier
    ) {}

    private async submitTransfer(
        batchID: BigNumberish,
        batch: ConcreteBatch<TransferCommitment>,
        stakingAmount: BigNumberish
    ) {
        return await this.rollup.submitTransfer(
            batchID,
            batch.commitments.map(c => c.stateRoot),
            batch.commitments.map(c => c.signature),
            batch.commitments.map(c => c.feeReceiver),
            batch.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }

    public async packAndSubmit(): Promise<ContractTransaction> {
        const { batches, transactions } = this.storageManager;
        const { batch, acceptedTxs, failedTxs } = await packBatch(
            this.pool,
            this.storageManager,
            this.params,
            this.verifier
        );
        const batchID = await batches.nextBatchID();
        console.info("Submitting batch", batch.toString());
        const l1Txn = await this.submitTransfer(
            batchID,
            batch,
            this.params.STAKE_AMOUNT
        );
        console.info(
            `Batch submited L1 txn hash ${prettyHex(l1Txn.hash)}`,
            batch.toString()
        );

        // Sync with storage
        await batches.add(batch, l1Txn);
        for (const acceptedTx of acceptedTxs) {
            await transactions.submitted(acceptedTx.message(), {
                batchID,
                l1TxnHash: l1Txn.hash,
                // TODO Figure out how to get finalization state in this scope.
                // https://github.com/thehubbleproject/hubble-contracts/issues/592
                l1BlockIncluded: -1
            });
        }
        for (const failedTx of failedTxs) {
            await transactions.failed(
                failedTx.tx.message(),
                failedTx.err.message
            );
        }

        return l1Txn;
    }
}
