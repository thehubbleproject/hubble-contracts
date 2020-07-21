import * as mcl from "./mcl";
import {Tree} from "./tree";

const amountLen = 4;
const accountIDLen = 4;
const stateIDLen = 4;
const indexLen = 4;
const tokenIdLen = 2;
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

export function serialize(txs: TxTransfer[]) {
  const serialized = "0x" + txs.map(tx => tx.encode()).join("");
  const commit = web3.utils.soliditySha3({t: "bytes", v: serialized});
  return {serialized, commit};
}

export class TxTransfer {
  public static rand(): TxTransfer {
    const sender = web3.utils.hexToNumber(web3.utils.randomHex(stateIDLen));
    const receiver = web3.utils.hexToNumber(web3.utils.randomHex(stateIDLen));
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
      {v: this.senderID, t: "uint32"},
      {v: this.receiverID, t: "uint32"},
      {v: this.amount, t: "uint32"},
      {v: this.nonce, t: "uint32"}
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
    let nonce = web3.utils.padLeft(web3.utils.toHex(this.nonce), nonceLen * 2);
    let encoded =
      sender.slice(2) + receiver.slice(2) + amount.slice(2) + nonce.slice(2);
    if (prefix) {
      encoded = "0x" + encoded;
    }
    return encoded;
  }
}
