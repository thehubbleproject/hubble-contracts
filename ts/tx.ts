import { Tree } from "./tree";
import { ethers } from "ethers";
import { paddedHex, randomNum } from "./utils";

const amountLen = 4;
const feeLen = 4;
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

export function serialize(txs: Tx[]) {
    const serialized = "0x" + txs.map(tx => tx.encode()).join("");
    const commit = ethers.utils.solidityKeccak256(["bytes"], [serialized]);
    return { serialized, commit };
}

export class TxTransfer implements SignableTx {
    private readonly TX_TYPE = "01";
    public static rand(): TxTransfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const amount = randomNum(amountLen);
        const fee = randomNum(feeLen);
        const nonce = randomNum(nonceLen);
        return new TxTransfer(sender, receiver, amount, fee, nonce);
    }
    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: number,
        public readonly fee: number,
        public nonce: number
    ) {}

    public message(): string {
        let nonce = paddedHex(this.nonce, nonceLen);

        return "0x" + this.TX_TYPE + nonce.slice(2) + this.encode(false);
    }

    public hash(): string {
        return ethers.utils.solidityKeccak256(
            ["uint32", "uint32", "uint32", "uint32"],
            [this.fromIndex, this.toIndex, this.amount, this.fee]
        );
    }

    public extended() {
        return {
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce,
            tokenType: 0,
            txType: 0
        };
    }

    public encode(prefix: boolean = false): string {
        let fromIndex = paddedHex(this.fromIndex, stateIDLen);
        let toIndex = paddedHex(this.toIndex, stateIDLen);
        let amount = paddedHex(this.amount, amountLen);
        let fee = paddedHex(this.fee, feeLen);

        let encoded =
            fromIndex.slice(2) +
            toIndex.slice(2) +
            amount.slice(2) +
            fee.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxMassMigration implements SignableTx {
    private readonly TX_TYPE = "06";
    public static rand(): TxMassMigration {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const amount = randomNum(amountLen);
        const fee = randomNum(feeLen);
        const nonce = randomNum(nonceLen);
        const spokeID = randomNum(spokeLen);
        return new TxMassMigration(
            sender,
            receiver,
            amount,
            spokeID,
            fee,
            nonce
        );
    }
    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: number,
        public readonly spokeID: number,
        public readonly fee: number,
        public nonce: number
    ) {}

    public message(): string {
        let nonce = paddedHex(this.nonce, nonceLen);

        return "0x" + this.TX_TYPE + nonce.slice(2) + this.encode(false);
    }

    public hash(): string {
        return ethers.utils.solidityKeccak256(
            ["uint32", "uint32", "uint32", "uint32", "uint32"],
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
            tokenType: 0,
            txType: 0
        };
    }

    public encode(prefix: boolean = false): string {
        let fromIndex = paddedHex(this.fromIndex, stateIDLen);
        let toIndex = paddedHex(this.toIndex, stateIDLen);
        let amount = paddedHex(this.amount, amountLen);
        let spokeID = paddedHex(this.spokeID, spokeLen);
        let fee = paddedHex(this.fee, feeLen);

        let encoded =
            fromIndex.slice(2) +
            toIndex.slice(2) +
            amount.slice(2) +
            spokeID.slice(2) +
            fee.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }

        return encoded;
    }
}
