import * as mcl from "./mcl";
import { Tree } from "./tree";

const amountLen = 4;
const accountIDLen = 4;
const stateIDLen = 4;
const tokenLen = 2;
const nonceLen = 4;
const signatureLen = 64;

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
        const signature = web3.utils.randomHex(signatureLen);
        return new TxTransfer(sender, receiver, amount, nonce, signature);
    }
    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: number,
        public readonly nonce: number,
        public readonly signature: string
    ) {}

    public hash(): string {
        return web3.utils.soliditySha3(
            { v: this.fromIndex, t: "uint256" },
            { v: this.toIndex, t: "uint256" },
            { v: this.amount, t: "uint256" },
            { v: this.nonce, t: "uint256" }
        );
    }

    public extended() {
        return {
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            signature: this.signature,
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
        let signature = this.signature;

        let encoded =
            fromIndex.slice(2) +
            toIndex.slice(2) +
            amount.slice(2) +
            signature.slice(2);
        if (prefix) {
            encoded = "0x" + encoded;
        }
        return encoded;
    }
}
