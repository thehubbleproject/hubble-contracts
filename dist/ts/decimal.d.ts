import { BigNumber, BigNumberish, BytesLike } from "ethers";
export declare class DecimalCodec {
    readonly exponentBits: number;
    readonly mantissaBits: number;
    readonly place: number;
    private mantissaMax;
    private exponentMax;
    private exponentMask;
    bytesLength: number;
    constructor(exponentBits: number, mantissaBits: number, place: number);
    rand(): string;
    randInt(): BigNumber;
    randNum(): number;
    /**
     * Given an arbitrary js number returns a js number that can be encoded.
     */
    cast(input: number): number;
    /**
     * Given an arbitrary js number returns a integer that can be encoded
     */
    castInt(input: number): BigNumber;
    encode(input: number): string;
    decode(input: BytesLike): number;
    encodeInt(input: BigNumberish): string;
    decodeInt(input: BytesLike): BigNumber;
}
export declare const USDT: DecimalCodec;
