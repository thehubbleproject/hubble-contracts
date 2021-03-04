import { TransactionDescription } from "@ethersproject/abi";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import {
    arrayify,
    concat,
    hexlify,
    hexZeroPad,
    solidityPack
} from "ethers/lib/utils";
import { SignatureInterface } from "../../blsSigner";
import { float16 } from "../../decimal";
import { sumNumber } from "../../utils";
import { StorageManager } from "../storageEngine";
import { BaseCommitment, ConcreteBatch } from "./base";
import {
    BatchMeta,
    Feature,
    SolStruct,
    StateMachine,
    CompressedTx,
    OffchainTx,
    StateIDLen,
    FloatLength
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
export class TransferCommitment extends BaseCommitment {
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: BigNumberish[],
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
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

export class TransferStateMachine implements StateMachine {
    async validate(
        commitment: TransferCommitment,
        storageManager: StorageManager
    ): Promise<void> {
        throw new Error("not implemented");
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

    getStateMachine() {
        return new TransferStateMachine();
    }
}
