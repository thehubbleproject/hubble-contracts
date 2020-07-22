import * as mcl from "./mcl";
import {Tx} from "./tx";

const accountIDLen = 4;
// const tokenTypeLen = 2;
// const balanceLen = 4;
// const nonceLen = 4;

export interface StateAccountSolStruct {
  ID: number;
  tokenType: number;
  balance: number;
  nonce: number;
  burn: number;
  lastBurn: number;
}

// TODO: is this considered as an empty account?
export const EMPTY_ACCOUNT: StateAccountSolStruct = {
  ID: 0,
  tokenType: 0,
  balance: 0,
  nonce: 0,
  burn: 0,
  lastBurn: 0
};
// "0x8000000000000000000000000000000000000000000000000000000000000000";

export class Account {
  publicKey: mcl.PublicKey;
  secretKey: mcl.SecretKey;
  public static new(
    accountID: number,
    tokenType: number,
    balance: number,
    nonce: number,
    stateID: number = -1
  ): Account {
    return new Account(accountID, tokenType, balance, nonce, stateID);
  }

  constructor(
    public accountID: number,
    public tokenType: number,
    public balance: number,
    public nonce: number,
    public stateID: number = -1
  ) {}

  public newKeyPair(): Account {
    const keyPair = mcl.newKeyPair();
    this.publicKey = keyPair.pubkey;
    this.secretKey = keyPair.secret;
    return this;
  }

  public sign(tx: Tx) {
    const msg = tx.encode(true);
    const {signature, M} = mcl.sign(msg, this.secretKey);
    return signature;
  }

  public setStateID(stateID: number): Account {
    this.stateID = stateID;
    return this;
  }

  // public toStateLeaf(): string {
  //   return web3.utils.soliditySha3(
  //     {v: this.accountID, t: "uint32"},
  //     {v: this.tokenType, t: "uint16"},
  //     {v: this.balance, t: "uint32"},
  //     {v: this.nonce, t: "uint32"}
  //   );
  // }
  // TODO: should use the one above?
  public toStateLeaf(): string {
    return web3.utils.soliditySha3(
      {v: this.accountID, t: "uint256"},
      {v: this.balance, t: "uint256"},
      {v: this.nonce, t: "uint256"},
      {v: this.tokenType, t: "uint256"},
      {v: 0, t: "uint256"}, // burn
      {v: 0, t: "uint256"} // lastBurn
    );
  }

  public toSolStruct(): StateAccountSolStruct {
    return {
      ID: this.accountID,
      tokenType: this.tokenType,
      balance: this.balance,
      nonce: this.nonce,
      burn: 0,
      lastBurn: 0
    };
  }

  public encodePubkey(): string[] {
    return mcl.g2ToHex(this.publicKey);
  }

  public toAccountLeaf(): string {
    const publicKey = mcl.g2ToHex(this.publicKey);
    return web3.utils.soliditySha3(
      {v: publicKey[0], t: "uint256"},
      {v: publicKey[1], t: "uint256"},
      {v: publicKey[2], t: "uint256"},
      {v: publicKey[3], t: "uint256"}
    );
  }

  public encodeAccountID(prefix: boolean = false): string {
    let encoded = web3.utils.padLeft(
      web3.utils.toHex(this.accountID),
      accountIDLen * 2
    );
    if (!prefix) {
      return encoded.slice(2);
      // encoded = "0x" + encoded;
    }
    return encoded;
  }

  // public encode(): string {
  //   let serialized = "0x";
  //   let accountID = web3.utils.padLeft(
  //     web3.utils.toHex(this.accountID),
  //     accountIDLen * 2
  //   );
  //   let tokenType = web3.utils.padLeft(
  //     web3.utils.toHex(this.tokenType),
  //     tokenTypeLen * 2
  //   );
  //   let balance = web3.utils.padLeft(
  //     web3.utils.toHex(this.balance),
  //     balanceLen * 2
  //   );
  //   let nonce = web3.utils.padLeft(web3.utils.toHex(this.nonce), nonceLen * 2);
  //   serialized = web3.utils.padLeft(
  //     serialized +
  //       accountID.slice(2) +
  //       tokenType.slice(2) +
  //       balance.slice(2) +
  //       nonce.slice(2),
  //     64
  //   );
  //   return serialized;
  // }

  // public static decode(encoded: string): Account {
  //   if (encoded.slice(0, 2) == "0x") {
  //     assert.lengthOf(encoded, 66);
  //     encoded = encoded.slice(2);
  //   } else {
  //     assert.lengthOf(encoded, 64);
  //   }
  //   assert.isTrue(web3.utils.isHex(encoded));
  //   let t0 = 64 - nonceLen * 2;
  //   let t1 = 64;
  //   const nonce = web3.utils.hexToNumber("0x" + encoded.slice(t0, t1));
  //   t1 = t0;
  //   t0 = t0 - balanceLen * 2;
  //   const balance = web3.utils.hexToNumber("0x" + encoded.slice(t0, t1));
  //   t1 = t0;
  //   t0 = t0 - tokenTypeLen * 2;
  //   const tokenType = web3.utils.hexToNumber("0x" + encoded.slice(t0, t1));
  //   t1 = t0;
  //   t0 = t0 - accountIDLen * 2;
  //   const accountID = web3.utils.hexToNumber("0x" + encoded.slice(t0, t1));
  //   return Account.new(accountID, tokenType, balance, nonce);
  // }
}
