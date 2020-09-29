import { Tree } from "./tree";
import { BigNumber } from "ethers";
import { randomNum } from "./utils";
import { DecimalCodec, USDT } from "./decimal";
import { MismatchByteLength } from "./exceptions";
import {
    hexZeroPad,
    concat,
    hexlify,
    solidityKeccak256,
    defaultAbiCoder,
} from "ethers/lib/utils";
import { COMMIT_SIZE } from "./constants";

const amountLen = 2;
const feeLen = 2;
const stateIDLen = 4;
const nonceLen = 4;
const spokeLen = 4;

function log2(n: number) {
    return Math.ceil(Math.log2(n));
}

export interface Tx {
    hash(): string;
    encode(prefix?: boolean): string;
}

export interface SignableTx extends Tx {
    message(): string;
}

export function calculateRoot(txs: Tx[]) {
    const depth = log2(txs.length);
    const tree = Tree.new(depth);
    for (let i = 0; i < txs.length; i++) {
        const leaf = txs[i].hash();
        tree.updateSingle(i, leaf);
    }
    return tree.root;
}

export function serialize(txs: Tx[]): string {
    return hexlify(concat(txs.map((tx) => tx.encode())));
}

function checkByteLength(
    decimal: DecimalCodec,
    fieldName: string,
    expected: number
) {
    if (decimal.bytesLength != expected) {
        throw new MismatchByteLength(
            `Deciaml: ${decimal.bytesLength} bytes, ${fieldName}: ${expected} bytes`
        );
    }
}

export class TxTransfer implements SignableTx {
    private readonly TX_TYPE = "0x01";
    public static rand(): TxTransfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const amount = USDT.randInt();
        const fee = USDT.randInt();
        const nonce = randomNum(nonceLen);
        return new TxTransfer(sender, receiver, amount, fee, nonce, USDT);
    }

    public static buildList(n: number = COMMIT_SIZE): TxTransfer[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxTransfer.rand());
        }
        return txs;
    }

    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public readonly decimal: DecimalCodec
    ) {
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }

    public message(): string {
        return defaultAbiCoder.encode(
            ["uint8", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.nonce,
                this.amount.toString(),
                this.fee,
            ]
        );
    }

    public hash(): string {
        return solidityKeccak256(
            ["uint32", "uint32", "uint16", "uint16"],
            [
                this.fromIndex,
                this.toIndex,
                this.decimal.encodeInt(this.amount),
                this.decimal.encodeInt(this.fee),
            ]
        );
    }

    public extended() {
        return {
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce,
            txType: 0,
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee),
        ]);
        return hexlify(concated);
    }
}

export class TxMassMigration implements SignableTx {
    private readonly TX_TYPE = "0x06";
    public static rand(): TxMassMigration {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const amount = USDT.randInt();
        const fee = USDT.randInt();
        const nonce = randomNum(nonceLen);
        const spokeID = randomNum(spokeLen);
        return new TxMassMigration(
            sender,
            receiver,
            amount,
            spokeID,
            fee,
            nonce,
            USDT
        );
    }
    public static buildList(n: number = COMMIT_SIZE): TxMassMigration[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxMassMigration.rand());
        }
        return txs;
    }
    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: BigNumber,
        public readonly spokeID: number,
        public readonly fee: BigNumber,
        public nonce: number,
        public readonly decimal: DecimalCodec
    ) {
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }

    public message(): string {
        const concated = concat([
            this.TX_TYPE,
            hexZeroPad(hexlify(this.nonce), nonceLen),
            this.encode(),
        ]);
        return hexlify(concated);
    }

    public hash(): string {
        return solidityKeccak256(
            ["uint32", "uint32", "uint16", "uint32", "uint16"],
            [this.fromIndex, this.toIndex, this.amount, this.spokeID, this.fee]
        );
    }

    public extended() {
        return {
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            spokeID: this.spokeID,
            fee: this.fee,
            nonce: this.nonce,
            txType: 0,
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            this.decimal.encodeInt(this.amount),
            hexZeroPad(hexlify(this.spokeID), spokeLen),
            this.decimal.encodeInt(this.fee),
        ]);
        return hexlify(concated);
    }
}

export class TxCreate2Transfer implements SignableTx {
    private readonly TX_TYPE = "0x03";
    public static rand(): TxCreate2Transfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const senderPub: string[] = [];
        const receiverPub: string[] = [];
        const toAccID = randomNum(stateIDLen);
        const amount = USDT.randInt();
        const fee = USDT.randInt();
        const nonce = randomNum(nonceLen);
        return new TxCreate2Transfer(
            sender,
            receiver,
            senderPub,
            receiverPub,
            toAccID,
            amount,
            fee,
            nonce,
            USDT
        );
    }
    public static buildList(n: number = COMMIT_SIZE): TxCreate2Transfer[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxCreate2Transfer.rand());
        }
        return txs;
    }

    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly fromPubkey: string[],
        public readonly toPubkey: string[],
        public readonly toAccID: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public readonly decimal: DecimalCodec
    ) {
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }

    public message(): string {
        return defaultAbiCoder.encode(
            [
                "uint8",
                "uint256[4]",
                "uint256[4]",
                "uint256",
                "uint256",
                "uint256",
            ],
            [
                this.TX_TYPE,
                this.fromPubkey,
                this.toPubkey,
                this.nonce,
                this.amount.toString(),
                this.fee,
            ]
        );
    }

    public hash(): string {
        return solidityKeccak256(
            ["uint32", "uint32", "uint16", "uint16"],
            [
                this.fromIndex,
                this.toIndex,
                this.toAccID,
                this.decimal.encodeInt(this.amount),
                this.decimal.encodeInt(this.fee),
            ]
        );
    }

    public extended() {
        return {
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            toPubkeyIndex: this.toAccID,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce,
            txType: this.TX_TYPE,
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            hexZeroPad(hexlify(this.toAccID), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee),
        ]);
        return hexlify(concated);
    }
}
