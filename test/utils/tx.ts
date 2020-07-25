import * as mcl from "./mcl";
import { Tree } from "./tree";

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
        public readonly senderID: number,
        public readonly receiverID: number,
        public readonly amount: number,
        public readonly nonce: number
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.senderID, t: "uint32" },
            { v: this.receiverID, t: "uint32" },
            { v: this.amount, t: "uint32" },
            { v: this.nonce, t: "uint32" }
        );
    }

    public mapToPoint() {
        const e = this.hash();
        return mcl.g1ToHex(mcl.mapToPoint(e));
    }

    public encode(prefix: boolean = false): string {
        let sender = web3.utils.padLeft(
            web3.utils.toHex(this.senderID),
            stateIDLen * 2
        );
        let receiver = web3.utils.padLeft(
            web3.utils.toHex(this.receiverID),
            stateIDLen * 2
        );
        let amount = web3.utils.padLeft(
            web3.utils.toHex(this.amount),
            amountLen * 2
        );
        let nonce = web3.utils.padLeft(
            web3.utils.toHex(this.nonce),
            nonceLen * 2
        );
        let encoded =
            sender.slice(2) +
            receiver.slice(2) +
            amount.slice(2) +
            nonce.slice(2);
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
        const stateID = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        const amount = web3.utils.hexToNumber(web3.utils.randomHex(amountLen));
        const nonce = web3.utils.hexToNumber(web3.utils.randomHex(nonceLen));
        return new TxBurnConsent(stateID, amount, nonce);
    }
    constructor(
        public readonly stateID: number,
        public readonly amount: number,
        public readonly nonce: number
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.stateID, t: "uint32" },
            { v: this.amount, t: "uint32" },
            { v: this.nonce, t: "uint32" }
        );
    }

    public mapToPoint() {
        const e = this.hash();
        return mcl.g1ToHex(mcl.mapToPoint(e));
    }

    public encode(prefix: boolean = false): string {
        let stateID = web3.utils.padLeft(
            web3.utils.toHex(this.stateID),
            stateIDLen * 2
        );
        let amount = web3.utils.padLeft(
            web3.utils.toHex(this.amount),
            amountLen * 2
        );
        let nonce = web3.utils.padLeft(
            web3.utils.toHex(this.nonce),
            amountLen * 2
        );
        let encoded = stateID.slice(2) + amount.slice(2) + nonce.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxBurnExecution {
    public static rand(): TxBurnExecution {
        const stateID = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        return new TxBurnExecution(stateID);
    }
    constructor(public readonly stateID: number) {}

    public hash(): string {
        return web3.utils.soliditySha3({ v: this.stateID, t: "uint32" });
    }

    public encode(prefix: boolean = false): string {
        let stateID = web3.utils.padLeft(
            web3.utils.toHex(this.stateID),
            stateIDLen * 2
        );
        let encoded = stateID.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxAirdropReceiver {
    public static rand(): TxAirdropReceiver {
        const receiverID = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        const amount = web3.utils.hexToNumber(web3.utils.randomHex(amountLen));
        return new TxAirdropReceiver(receiverID, amount);
    }
    constructor(
        public readonly receiverID: number,
        public readonly amount: number
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.receiverID, t: "uint32" },
            { v: this.amount, t: "uint32" }
        );
    }

    public encode(prefix: boolean = false): string {
        let receiverID = web3.utils.padLeft(
            web3.utils.toHex(this.receiverID),
            stateIDLen * 2
        );
        let amount = web3.utils.padLeft(
            web3.utils.toHex(this.amount),
            amountLen * 2
        );
        let encoded = receiverID.slice(2) + amount.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}

export class TxAirdropSender {
    public static rand(): TxAirdropSender {
        const accountID = web3.utils.hexToNumber(
            web3.utils.randomHex(accountIDLen)
        );
        const stateID = web3.utils.hexToNumber(
            web3.utils.randomHex(stateIDLen)
        );
        const nonce = web3.utils.hexToNumber(web3.utils.randomHex(nonceLen));
        return new TxAirdropSender(accountID, stateID, nonce);
    }
    constructor(
        public readonly accountID: number,
        public readonly stateID: number,
        public readonly nonce: number
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.accountID, t: "uint32" },
            { v: this.stateID, t: "uint32" },
            { v: this.nonce, t: "uint32" }
        );
    }

    public encode(prefix: boolean = false): string {
        let accountID = web3.utils.padLeft(
            web3.utils.toHex(this.accountID),
            stateIDLen * 2
        );
        let stateID = web3.utils.padLeft(
            web3.utils.toHex(this.stateID),
            stateIDLen * 2
        );
        let nonce = web3.utils.padLeft(
            web3.utils.toHex(this.nonce),
            amountLen * 2
        );
        let encoded = accountID.slice(2) + stateID.slice(2) + nonce.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}
