import { BigNumber } from "ethers";
import { DecimalCodec } from "./decimal";
export interface Tx {
    encode(prefix?: boolean): string;
    encodeOffchain(): string;
}
export interface SignableTx extends Tx {
    message(): string;
}
export declare function serialize(txs: Tx[]): string;
export declare class TxTransfer implements SignableTx {
    readonly fromIndex: number;
    readonly toIndex: number;
    readonly amount: BigNumber;
    readonly fee: BigNumber;
    nonce: number;
    readonly decimal: DecimalCodec;
    private readonly TX_TYPE;
    static rand(): TxTransfer;
    static buildList(n?: number): TxTransfer[];
    constructor(fromIndex: number, toIndex: number, amount: BigNumber, fee: BigNumber, nonce: number, decimal: DecimalCodec);
    message(): string;
    encodeOffchain(): string;
    encode(): string;
}
export declare class TxMassMigration implements SignableTx {
    readonly fromIndex: number;
    readonly amount: BigNumber;
    readonly spokeID: number;
    readonly fee: BigNumber;
    nonce: number;
    readonly decimal: DecimalCodec;
    private readonly TX_TYPE;
    static rand(): TxMassMigration;
    static buildList(n?: number): TxMassMigration[];
    constructor(fromIndex: number, amount: BigNumber, spokeID: number, fee: BigNumber, nonce: number, decimal: DecimalCodec);
    message(): string;
    encodeOffchain(): string;
    encode(): string;
}
export declare class TxCreate2Transfer implements SignableTx {
    readonly fromIndex: number;
    readonly toIndex: number;
    readonly fromPubkey: string[];
    readonly toPubkey: string[];
    readonly toAccID: number;
    readonly amount: BigNumber;
    readonly fee: BigNumber;
    nonce: number;
    readonly decimal: DecimalCodec;
    private readonly TX_TYPE;
    static rand(): TxCreate2Transfer;
    static buildList(n?: number): TxCreate2Transfer[];
    constructor(fromIndex: number, toIndex: number, fromPubkey: string[], toPubkey: string[], toAccID: number, amount: BigNumber, fee: BigNumber, nonce: number, decimal: DecimalCodec);
    message(): string;
    encodeOffchain(): string;
    encode(): string;
}
