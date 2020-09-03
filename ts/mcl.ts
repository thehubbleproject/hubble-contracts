const mcl = require("mcl-wasm");
import { randomHex } from "./utils";
import BN from "bn.js";
import { ethers } from "ethers";

export type mclG2 = any;
export type mclG1 = any;
export type mclFP = any;
export type mclFR = any;
export type PublicKey = mclG2;
export type SecretKey = mclFR;

export const FIELD_ORDER = bn(
    "0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47"
);
export const ZERO = bn("0x00");

export async function init() {
    await mcl.init(mcl.BN_SNARK1);
    mcl.setMapToMode(1);
}

export function hashToPoint(data: string) {
    const e0 = bn(ethers.utils.keccak256(data)!);
    let e1 = new mcl.Fp();
    e1.setStr(e0.mod(FIELD_ORDER).toString());
    return e1.mapToG1();
}

export function mapToPoint(eHex: string) {
    const e0 = bn(eHex);
    let e1 = new mcl.Fp();
    e1.setStr(e0.mod(FIELD_ORDER).toString());
    return e1.mapToG1();
}

export function bnToHex(n: any) {
    return ethers.utils.hexZeroPad("0x" + n.toString(16), 32);
}

export function bn(n: string) {
    if (n.length > 2 && n.slice(0, 2) == "0x") {
        return new BN(n.slice(2), "hex");
    }
    return new BN(n, "hex");
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

export function signOfG1(p: mclG1): boolean {
    const y = bn(mclToHex(p.getY()));
    return y.isOdd();
}

export function signOfG2(p: mclG2): boolean {
    p.normalize();
    const y = mclToHex(p.getY(), false);
    return bn(y.slice(64)).isOdd();
}

export function g1ToCompressed(p: mclG1) {
    p.normalize();
    if (signOfG1(p)) {
        const x = bn(mclToHex(p.getX()));
        const masked = x.or(
            bn(
                "8000000000000000000000000000000000000000000000000000000000000000"
            )
        );
        return bnToHex(masked);
    } else {
        return mclToHex(p.getX());
    }
}

export function g1ToBN(p: mclG1) {
    p.normalize();
    const x = bn(mclToHex(p.getX()));
    const y = bn(mclToHex(p.getY()));
    return [x, y];
}

export function g1ToHex(p: mclG1) {
    p.normalize();
    const x = mclToHex(p.getX());
    const y = mclToHex(p.getY());
    return [x, y];
}

export function g2ToCompressed(p: mclG2) {
    p.normalize();
    const x = mclToHex(p.getX(), false);
    if (signOfG2(p)) {
        const masked = bn(x.slice(64)).or(
            bn(
                "8000000000000000000000000000000000000000000000000000000000000000"
            )
        );
        // return masked.toString(16, 64) + x.slice(0, 64);
        return [bnToHex(masked), "0x" + x.slice(0, 64)];
    } else {
        // return '0x' + x.slice(64) + x.slice(0, 64);
        return ["0x" + x.slice(64), "0x" + x.slice(0, 64)];
    }
}

export function g2ToBN(p: mclG2) {
    const x = mclToHex(p.getX(), false);
    const y = mclToHex(p.getY(), false);
    return [
        bn(x.slice(64)),
        bn(x.slice(0, 64)),
        bn(y.slice(64)),
        bn(y.slice(0, 64))
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

export function compressPubkey(p: mclG2) {
    return g2ToCompressed(p);
}

export function compressSignature(p: mclG1) {
    return g1ToCompressed(p);
}

export function newG1() {
    return new mcl.G1();
}

export function newG2() {
    return new mcl.G2();
}

export function randFr() {
    const r = randomHex(12);
    let fr = new mcl.Fr();
    fr.setHashOf(r);
    return fr;
}

export function randFs() {
    const r = bn(randomHex(32));
    return r.umod(FIELD_ORDER);
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
