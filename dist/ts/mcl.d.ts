import { BigNumber } from "ethers";
export declare type mclG2 = any;
export declare type mclG1 = any;
export declare type mclFP = any;
export declare type mclFR = any;
export declare type PublicKey = solG2;
export declare type SecretKey = mclFR;
export declare type Signature = mclG1;
export declare type Message = solG1;
export declare type solG1 = [string, string];
export declare type solG2 = [string, string, string, string];
export interface keyPair {
    pubkey: PublicKey;
    secret: SecretKey;
}
export declare function init(): Promise<void>;
export declare function setDomain(domain: string): void;
export declare function setDomainHex(domain: string): void;
export declare function hashToPoint(msg: string): mclG1;
export declare function mapToPoint(e0: BigNumber): mclG1;
export declare function toBigEndian(p: mclFP): Uint8Array;
export declare function g1(): mclG1;
export declare function g2(): mclG2;
export declare function g1ToHex(p: mclG1): solG1;
export declare function g2ToHex(p: mclG2): solG2;
export declare function newKeyPair(): keyPair;
export declare function sign(message: string, secret: SecretKey): {
    signature: Signature;
    M: Message;
};
export declare function aggreagate(signatures: Signature[]): solG1;
export declare function newG1(): solG1;
export declare function newG2(): solG2;
export declare function randFr(): mclFR;
export declare function randG1(): solG1;
export declare function randG2(): solG2;
export declare const getMclInstance: () => any;
