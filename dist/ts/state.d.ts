import * as mcl from "./mcl";
import { SignableTx } from "./tx";
import { BigNumber, BigNumberish } from "ethers";
export interface StateSolStruct {
    pubkeyIndex: number;
    tokenType: number;
    balance: number;
    nonce: number;
}
/**
 * @dev this is not an zero state leaf contrarily this is a legit state!
 */
export declare const EMPTY_STATE: StateSolStruct;
export declare class State {
    pubkeyIndex: number;
    tokenType: number;
    balance: BigNumber;
    nonce: number;
    publicKey: mcl.PublicKey;
    secretKey: mcl.SecretKey;
    static new(pubkeyIndex: number, tokenType: number, balance: BigNumberish, nonce: number): State;
    clone(): State;
    stateID: number;
    constructor(pubkeyIndex: number, tokenType: number, balance: BigNumber, nonce: number);
    newKeyPair(): State;
    sign(tx: SignableTx): any;
    setStateID(stateID: number): State;
    setPubkey(pubkey: mcl.PublicKey): State;
    getPubkey(): mcl.PublicKey;
    encode(): string;
    toStateLeaf(): string;
    toSolStruct(): StateSolStruct;
    toAccountLeaf(): string;
}
