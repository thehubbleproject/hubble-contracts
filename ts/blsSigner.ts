import {
    solG2,
    Domain,
    getPubkey,
    g2ToHex,
    sign,
    g1ToHex,
    aggregateRaw,
    mclG1,
    solG1,
    SecretKey,
    randFr,
    PublicKey,
    parseFr,
    parseG1,
    parseG2,
    hashToPoint,
    verifyRaw
} from "./mcl";

export interface SignatureInterface {
    mcl: mclG1;
    sol: solG1;
}

export class BlsVerifier {
    constructor(public readonly domain: Domain) {}
    public verify(signature: solG1, pubkey: solG2, message: string) {
        const signatureG1 = parseG1(signature);
        const pubkeyG2 = parseG2(pubkey);
        const messagePoint = hashToPoint(message, this.domain);
        return verifyRaw(signatureG1, pubkeyG2, messagePoint);
    }
}

export class BlsSigner {
    static new(domain?: Domain, privKey?: string) {
        const secret = privKey ? parseFr(privKey) : randFr();
        return new this(secret, domain);
    }
    private _pubkey: PublicKey;
    constructor(private secret: SecretKey, private domain?: Domain) {
        this._pubkey = getPubkey(secret);
    }
    get pubkey(): solG2 {
        return g2ToHex(this._pubkey);
    }

    setDomain(domain: Domain) {
        this.domain = domain;
    }

    public sign(message: string): SignatureInterface {
        if (!this.domain) throw new Error("No domain is set");
        const { signature } = sign(message, this.secret, this.domain);
        const sol = g1ToHex(signature);
        return { mcl: signature, sol };
    }
}

export function aggregate(
    signatures: SignatureInterface[]
): SignatureInterface {
    const aggregated = aggregateRaw(signatures.map(s => s.mcl));
    return { mcl: aggregated, sol: g1ToHex(aggregated) };
}
