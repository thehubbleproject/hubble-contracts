import { TransactionDescription } from "@ethersproject/abi";
import { BigNumber, BigNumberish, BytesLike, Event } from "ethers";
import {
    arrayify,
    concat,
    hexlify,
    hexZeroPad,
    solidityPack
} from "ethers/lib/utils";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { aggregate, SignatureInterface } from "../../blsSigner";
import { float16 } from "../../decimal";
import { Group } from "../../factory";
import { DeploymentParameters } from "../../interfaces";
import { solG1 } from "../../mcl";
import { sum, sumNumber } from "../../utils";
import { processReceiver, processSender } from "../stateTransitions";
import { StateStorageEngine, StorageManager } from "../storageEngine";
import { BaseCommitment, ConcreteBatch } from "./base";
import {
    BatchMeta,
    Feature,
    SolStruct,
    StateMachine,
    CompressedTx,
    OffchainTx,
    StateIDLen,
    FloatLength,
    ProtocolParams,
    BatchHandlingStrategy,
    Commitment,
    BatchPackingCommand
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
        public readonly fromIndex: number,
        public readonly toIndex: number,
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
        const fromIndex = BigNumber.from(bytesArray[0]).toNumber();
        const toIndex = BigNumber.from(bytesArray[1]).toNumber();
        const amount = float16.decompress(bytesArray[2]);
        const fee = float16.decompress(bytesArray[3]);
        return new this(fromIndex, toIndex, amount, fee);
    }

    message(nonce: number): string {
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
}
export class TransferOffchainTx extends TransferCompressedTx
    implements OffchainTx {
    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public signature?: SignatureInterface
    ) {
        super(fromIndex, toIndex, amount, fee);
    }

    toCompressed() {
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

    public toString(): string {
        return `<Transfer ${this.fromIndex}->${this.toIndex} $${this.amount}  fee ${this.fee}  nonce ${this.nonce}>`;
    }
}

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
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }

    static fromTxs(
        txs: TransferOffchainTx[],
        stateRoot: BytesLike,
        accountRoot: BytesLike,
        feeReceiver: BigNumberish
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
        throw new Error("not implemented");
    }
}

async function processTransfer(
    tx: TransferCompressedTx,
    tokenID: number,
    engine: StateStorageEngine
): Promise<void> {
    await processSender(tx.fromIndex, tokenID, tx.amount, tx.fee, engine);
    await processReceiver(tx.toIndex, tx.amount, tokenID, engine);
}

async function process(
    commitment: TransferCommitment,
    storageManager: StorageManager,
    params: DeploymentParameters
): Promise<void> {
    const txs = commitment.decompressTxs();

    const feeReceiverID = Number(commitment.feeReceiver);
    const engine = storageManager.state;
    console.log("preroot", engine.root);
    const tokenID = (await engine.get(txs[0].fromIndex)).tokenID;
    if (txs.length > params.MAX_TXS_PER_COMMIT) throw new Error("Too many tx");
    for (const tx of txs) {
        await processTransfer(tx, tokenID, engine);
    }
    const fees = sum(txs.map(tx => tx.fee));
    await processReceiver(feeReceiverID, fees, tokenID, engine);
    await engine.commit();
    if (engine.root != commitment.stateRoot)
        throw new Error(
            `Validation failed  expect ${engine.root} got ${commitment.stateRoot}`
        );
}

export interface TransferPipe {
    source: AsyncGenerator<TransferOffchainTx>;
    tokenID: number;
    feeReceiverID: number;
}

async function pack(
    pipe: TransferPipe,
    storageManager: StorageManager,
    params: DeploymentParameters
): Promise<TransferCommitment> {
    const engine = storageManager.state;
    const acceptedTxs = [];

    for await (const tx of pipe.source) {
        if (acceptedTxs.length >= params.MAX_TXS_PER_COMMIT) break;
        try {
            await processTransfer(tx, pipe.tokenID, engine);
            acceptedTxs.push(tx);
        } catch (e) {
            console.error(`bad tx ${tx}  ${e}`);
        }
    }
    const fees = sum(acceptedTxs.map(tx => tx.fee));
    await processReceiver(pipe.feeReceiverID, fees, pipe.tokenID, engine);
    await engine.commit();
    return TransferCommitment.fromTxs(
        acceptedTxs,
        engine.root,
        storageManager.pubkey.root,
        pipe.feeReceiverID
    );
}

export class OffchainTransferFactory {
    constructor(
        public readonly group: Group,
        public readonly engine: StateStorageEngine
    ) {}
    async *genTx(): AsyncGenerator<TransferOffchainTx> {
        while (true) {
            for (const sender of this.group.userIterator()) {
                const { user: receiver } = this.group.pickRandom();
                const senderState = await this.engine.get(sender.stateID);
                const amount = float16.round(senderState.balance.div(10));
                const fee = float16.round(amount.div(10));
                const tx = new TransferOffchainTx(
                    sender.stateID,
                    receiver.stateID,
                    amount,
                    fee,
                    senderState.nonce
                );
                tx.signature = sender.signRaw(tx.message());
                yield tx;
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
    async parseBatch(event: Event) {
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

    async processBatch(batch: ConcreteBatch<TransferCommitment>) {
        for (const commitment of batch.commitments) {
            await process(commitment, this.storageManager, this.params);
        }
    }
}

export interface TransferPool {
    getNextPipe(): TransferPipe;
}

export class SimulatorPool extends OffchainTransferFactory
    implements TransferPool {
    private tokenID?: number;
    private feeReceiverID?: number;
    async setTokenID() {
        const stateID = this.group.getUser(0).stateID;
        const state = await this.engine.get(stateID);
        this.tokenID = state.tokenID;
        this.feeReceiverID = stateID;
    }

    getNextPipe() {
        const source = this.genTx();
        if (!this.tokenID || !this.feeReceiverID)
            throw new Error("tokenID or feeReceiver undefined");
        return {
            source,
            tokenID: this.tokenID,
            feeReceiverID: this.feeReceiverID
        };
    }
}

const MAX_COMMIT_PER_BATCH = 32;

export class TransferPackingCommand implements BatchPackingCommand {
    constructor(
        private params: DeploymentParameters,
        private storageManager: StorageManager,
        private pool: TransferPool
    ) {}
    async pack() {
        const commitments = [];
        for (let i = 0; i < MAX_COMMIT_PER_BATCH; i++) {
            const pipe = this.pool.getNextPipe();
            const commitment = await pack(
                pipe,
                this.storageManager,
                this.params
            );
            commitments.push(commitment);
        }
        return new ConcreteBatch(commitments);
    }
}
