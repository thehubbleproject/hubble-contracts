import * as mcl from "./mcl";
import { Tree } from "./tree";
import { sign } from "../../scripts/helpers/utils";

const amountLen = 4;
const accountIDLen = 4;
const stateIDLen = 4;
const tokenLen = 2;
const nonceLen = 4;

function log2(n: number) {
    return Math.ceil(Math.log2(n));
}

export interface Tx {
    hash(): string;
    encode(prefix?: boolean): string;
    message(domain: string): string;
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
    const commit = web3.utils.soliditySha3({ t: "bytes", v: serialized });
    return { serialized, commit };
}

export class TxTransfer {
    private readonly TX_TYPE = "01";
    public static rand(): TxTransfer {
        const sender = web3.utils.hexToNumber(web3.utils.randomHex(stateIDLen));
        const receiver = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        const amount = web3.utils.hexToNumber(web3.utils.randomHex(amountLen));
        const nonce = web3.utils.hexToNumber(web3.utils.randomHex(nonceLen));
        return new TxTransfer(sender, receiver, amount, nonce);
    }
    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: number,
        public nonce: number
    ) {}

    public message(domain: string): string {
        let nonce = web3.utils.padLeft(
            web3.utils.toHex(this.nonce),
            nonceLen * 2
        );

        return domain + this.TX_TYPE + nonce.slice(2) + this.encode(false);
    }

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.fromIndex, t: "uint32" },
            { v: this.toIndex, t: "uint32" },
            { v: this.amount, t: "uint32" }
        );
    }

    public extended() {
        return {
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            nonce: this.nonce,
            tokenType: 0,
            txType: 0
        };
    }

    public encode(prefix: boolean = false): string {
        let fromIndex = web3.utils.padLeft(
            web3.utils.toHex(this.fromIndex),
            stateIDLen * 2
        );
        let toIndex = web3.utils.padLeft(
            web3.utils.toHex(this.toIndex),
            stateIDLen * 2
        );
        let amount = web3.utils.padLeft(
            web3.utils.toHex(this.amount),
            amountLen * 2
        );

        let encoded = fromIndex.slice(2) + toIndex.slice(2) + amount.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxCreate {
    public static rand(): TxCreate {
        const accountID = web3.utils.hexToNumber(
            web3.utils.randomHex(accountIDLen)
        );
        const stateID = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        const tokenType = web3.utils.hexToNumber(
            web3.utils.randomHex(tokenLen)
        );
        return new TxCreate(accountID, stateID, tokenType);
    }
    constructor(
        public readonly accountID: number,
        public readonly stateID: number,
        public readonly tokenType: number
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.accountID, t: "uint32" },
            { v: this.stateID, t: "uint32" },
            { v: this.tokenType, t: "uint16" }
        );
    }

    public extended() {
        return {
            accountID: this.accountID,
            stateID: this.stateID,
            tokenType: this.tokenType,
            txType: 0
        };
    }

    public encode(prefix: boolean = false): string {
        let accountID = web3.utils.padLeft(
            web3.utils.toHex(this.accountID),
            accountIDLen * 2
        );
        let stateID = web3.utils.padLeft(
            web3.utils.toHex(this.stateID),
            stateIDLen * 2
        );
        let tokenType = web3.utils.padLeft(
            web3.utils.toHex(this.tokenType),
            tokenLen * 2
        );
        let encoded =
            accountID.slice(2) + stateID.slice(2) + tokenType.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxBurnConsent {
    public static rand(): TxBurnConsent {
        const fromIndex = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        const amount = web3.utils.hexToNumber(web3.utils.randomHex(amountLen));
        const nonce = web3.utils.hexToNumber(web3.utils.randomHex(nonceLen));
        return new TxBurnConsent(fromIndex, amount, nonce);
    }
    constructor(
        public readonly fromIndex: number,
        public readonly amount: number,
        public readonly nonce: number
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.fromIndex, t: "uint32" },
            { v: this.amount, t: "uint32" }
        );
    }

    public extended() {
        return {
            txType: 0,
            fromIndex: this.fromIndex,
            amount: this.amount,
            nonce: this.nonce
        };
    }

    public encode(prefix: boolean = false): string {
        let fromIndex = web3.utils.padLeft(
            web3.utils.toHex(this.fromIndex),
            stateIDLen * 2
        );
        let amount = web3.utils.padLeft(
            web3.utils.toHex(this.amount),
            amountLen * 2
        );
        let encoded = fromIndex.slice(2) + amount.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxBurnExecution {
    public static rand(): TxBurnExecution {
        const fromIndex = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        return new TxBurnExecution(fromIndex);
    }
    constructor(public readonly fromIndex: number) {}

    public hash(): string {
        return web3.utils.soliditySha3({ v: this.fromIndex, t: "uint32" });
    }

    public extended() {
        return {
            txType: 0,
            fromIndex: this.fromIndex
        };
    }

    public encode(prefix: boolean = false): string {
        let fromIndex = web3.utils.padLeft(
            web3.utils.toHex(this.fromIndex),
            stateIDLen * 2
        );
        let encoded = fromIndex.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}
