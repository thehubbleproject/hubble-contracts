/// <reference types="node" />
export interface Wallet {
    getAddressString(): string;
    getPublicKeyString(): string;
    getPrivateKey(): Buffer;
}
export declare const mnemonics: any;
export declare function generateFirstWallets(mnemonics: any, n: number, hdPathIndex?: number): Wallet[];
