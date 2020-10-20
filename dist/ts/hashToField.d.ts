import { BigNumber } from "ethers";
export declare const FIELD_ORDER: BigNumber;
export declare function hashToField(domain: Uint8Array, msg: Uint8Array, count: number): BigNumber[];
export declare function expandMsg(domain: Uint8Array, msg: Uint8Array, outLen: number): Uint8Array;
