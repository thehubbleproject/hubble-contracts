const mcl = require("mcl-wasm");
import { ethers } from "ethers";
import { toBig, FIELD_ORDER, randHex } from "./utils";
import { hashToField } from "./hash_to_field";

export type mclG2 = any;
export type mclG1 = any;
export type mclFP = any;
export type mclFR = any;
export type PublicKey = mclG2;
export type SecretKey = mclFR;

let DOMAIN: Uint8Array;

export async function init() {
    await mcl.init(mcl.BN_SNARK1);
    mcl.setMapToMode(0);
}

export function setDomain(domain: string) {
    DOMAIN = Uint8Array.from(Buffer.from(domain, "utf8"));
}

export function setDomainHex(domain: string) {
    DOMAIN = Uint8Array.from(Buffer.from(domain.slice(2), "hex"));
}

export function hashToPoint(msg: string) {
    if (!ethers.utils.isHexString(msg)) {
        throw new Error("message is expected to be hex string");
    }

    const _msg = Uint8Array.from(Buffer.from(msg.slice(2), "hex"));
    const hashRes = hashToField(DOMAIN, _msg, 2);
    const e0 = hashRes[0];
    const e1 = hashRes[1];
    const p0 = mapToPoint(e0.toHexString());
    const p1 = mapToPoint(e1.toHexString());
    const p = mcl.add(p0, p1);
    p.normalize();
    return p;
}

export function mapToPoint(eHex: string) {
    const e0 = toBig(eHex);
    let e1 = new mcl.Fp();
    e1.setStr(e0.mod(FIELD_ORDER).toString());
    return e1.mapToG1();
}

export function mclToHex(p: mclFP, prefix: boolean = true) {
    const arr = p.serialize();
    let s = "";
    for (let i = arr.length - 1; i >= 0; i--) {
        s += ("0" + arr[i].toString(16)).slice(-2);
    }
    return prefix ? "0x" + s : s;
}

export function g1() {
    const g1 = new mcl.G1();
    g1.setStr("1 0x01 0x02", 16);
    return g1;
}

export function g2() {
    const g2 = new mcl.G2();
    g2.setStr(
        "1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b"
    );
    return g2;
}

export function g1ToBig(p: mclG1) {
    p.normalize();
    const x = toBig(mclToHex(p.getX()));
    const y = toBig(mclToHex(p.getY()));
    return [x, y];
}

export function g1ToHex(p: mclG1) {
    p.normalize();
    const x = mclToHex(p.getX());
    const y = mclToHex(p.getY());
    return [x, y];
}

export function g2ToBig(p: mclG2) {
    const x = mclToHex(p.getX(), false);
    const y = mclToHex(p.getY(), false);
    return [
        toBig("0x" + x.slice(64)),
        toBig("0x" + x.slice(0, 64)),
        toBig("0x" + y.slice(64)),
        toBig("0x" + y.slice(0, 64))
    ];
}

export function g2ToHex(p: mclG2) {
    p.normalize();
    const x = mclToHex(p.getX(), false);
    const y = mclToHex(p.getY(), false);
    return [
        "0x" + x.slice(64),
        "0x" + x.slice(0, 64),
        "0x" + y.slice(64),
        "0x" + y.slice(0, 64)
    ];
}

export function newKeyPair() {
    const secret = randFr();
    const pubkey = mcl.mul(g2(), secret);
    pubkey.normalize();
    return { pubkey, secret };
}

export function sign(message: string, secret: mclFR) {
    const M = hashToPoint(message);
    const signature = mcl.mul(M, secret);
    signature.normalize();
    return { signature, M };
}

export function aggreagate(acc: mclG1 | mclG2, other: mclG1 | mclG2) {
    const _acc = mcl.add(acc, other);
    _acc.normalize();
    return _acc;
}

export function newG1() {
    return new mcl.G1();
}

export function newG2() {
    return new mcl.G2();
}

export function randFr() {
    const r = randHex(12);
    let fr = new mcl.Fr();
    fr.setHashOf(r);
    return fr;
}

export function randG1() {
    const p = mcl.mul(g1(), randFr());
    p.normalize();
    return p;
}

export function randG2() {
    const p = mcl.mul(g2(), randFr());
    p.normalize();
    return p;
}
