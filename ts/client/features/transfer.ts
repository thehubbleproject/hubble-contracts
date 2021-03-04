import { TransactionDescription } from "@ethersproject/abi";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import {
    arrayify,
    concat,
    hexlify,
    hexZeroPad,
    solidityPack
} from "ethers/lib/utils";
import { aggregate, SignatureInterface } from "../../blsSigner";
import { float16 } from "../../decimal";
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
    ProtocolParams
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
        public signature: SignatureInterface
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
            const tx = TransferCompressedTx.deserialize(bytes.slice(i, txLen));
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

export interface TransferPackingContext {
    tokenID: number;
    feeReceiverID: number;
}

export class TransferStateMachine implements StateMachine {
    constructor(public readonly params: ProtocolParams) {}
    async validate(
        commitment: TransferCommitment,
        storageManager: StorageManager
    ): Promise<void> {
        const txs = commitment.decompressTxs();

        const feeReceiverID = Number(commitment.feeReceiver);
        const engine = storageManager.state;
        const tokenID = (await engine.get(txs[0].fromIndex)).tokenID;
        if (txs.length > this.params.maxTxPerCommitment)
            throw new Error("Too many tx");
        for (const tx of txs) {
            await processTransfer(tx, tokenID, engine);
        }
        const fees = sum(txs.map(tx => tx.fee));
        await processReceiver(feeReceiverID, fees, tokenID, engine);
        await engine.commit();
        if (engine.root != commitment.stateRoot)
            throw new Error("Validation failed");
    }
    async pack(
        source: Generator<TransferOffchainTx>,
        storageManager: StorageManager,
        context: TransferPackingContext
    ): Promise<TransferCommitment> {
        const engine = storageManager.state;
        const acceptedTxs = [];

        for (const tx of source) {
            if (acceptedTxs.length >= this.params.maxTxPerCommitment) break;
            try {
                await processTransfer(tx, context.tokenID, engine);
                acceptedTxs.push(tx);
            } catch (e) {
                console.error(`bad tx ${tx}  ${e}`);
            }
        }
        const fees = sum(acceptedTxs.map(tx => tx.fee));
        await processReceiver(
            context.feeReceiverID,
            fees,
            context.tokenID,
            engine
        );
        await engine.commit();
        return TransferCommitment.fromTxs(
            acceptedTxs,
            engine.root,
            storageManager.pubkey.root,
            context.feeReceiverID
        );
    }
}

export class TransferFeature implements Feature {
    parseBatch(txDescription: TransactionDescription, batchMeta: BatchMeta) {
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
                batchMeta.accountRoot,
                signatures[i],
                feeReceivers[i],
                txss[i]
            );
            commitments.push(commitment);
        }
        return new ConcreteBatch(commitments);
    }

    getStateMachine(params: ProtocolParams) {
        return new TransferStateMachine(params);
    }
}
