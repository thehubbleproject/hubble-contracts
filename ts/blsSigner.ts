import {
    solG2,
    Domain,
    newKeyPair,
    mclG2,
    SecretKey,
    getPubkey,
    g2ToHex,
    sign,
    g1ToHex,
    Signature
} from "./mcl";

export interface BlsSignerInterface {
    pubkey: solG2;
    sign(message: string): Signature;
}

export class NullBlsSinger implements BlsSignerInterface {
    get pubkey(): solG2 {
        throw new Error("NullBlsSinger has no public key");
    }
    sign(message: string): Signature {
        throw new Error("NullBlsSinger dosen't sign");
    }
}

export class BlsSigner implements BlsSignerInterface {
    static new(domain: Domain) {
        const keyPair = newKeyPair();
        return new BlsSigner(domain, keyPair.secret);
    }
    private _pubkey: mclG2;
    constructor(public domain: Domain, private secret: SecretKey) {
        this._pubkey = getPubkey(secret);
    }
    get pubkey(): solG2 {
        return g2ToHex(this._pubkey);
    }

    public sign(message: string): Signature {
        const { signature } = sign(message, this.secret, this.domain);
        const sol = g1ToHex(signature);
        return { mcl: signature, sol };
    }
}
