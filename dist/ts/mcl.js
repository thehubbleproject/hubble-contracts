"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMclInstance = exports.randG2 = exports.randG1 = exports.randFr = exports.newG2 = exports.newG1 = exports.aggreagate = exports.sign = exports.newKeyPair = exports.g2ToHex = exports.g1ToHex = exports.g2 = exports.g1 = exports.toBigEndian = exports.mapToPoint = exports.hashToPoint = exports.setDomainHex = exports.setDomain = exports.init = void 0;
const mcl = require("mcl-wasm");
const ethers_1 = require("ethers");
const utils_1 = require("./utils");
const hashToField_1 = require("./hashToField");
const utils_2 = require("ethers/lib/utils");
let DOMAIN;
async function init() {
    await mcl.init(mcl.BN_SNARK1);
    mcl.setMapToMode(0);
}
exports.init = init;
function setDomain(domain) {
    DOMAIN = Uint8Array.from(Buffer.from(domain, "utf8"));
}
exports.setDomain = setDomain;
function setDomainHex(domain) {
    DOMAIN = Uint8Array.from(Buffer.from(domain.slice(2), "hex"));
    if (DOMAIN.length != 32) {
        throw new Error("bad domain length");
    }
}
exports.setDomainHex = setDomainHex;
function hashToPoint(msg) {
    if (!ethers_1.ethers.utils.isHexString(msg)) {
        throw new Error("message is expected to be hex string");
    }
    const _msg = utils_2.arrayify(msg);
    const [e0, e1] = hashToField_1.hashToField(DOMAIN, _msg, 2);
    const p0 = mapToPoint(e0);
    const p1 = mapToPoint(e1);
    const p = mcl.add(p0, p1);
    p.normalize();
    return p;
}
exports.hashToPoint = hashToPoint;
function mapToPoint(e0) {
    let e1 = new mcl.Fp();
    e1.setStr(e0.mod(utils_1.FIELD_ORDER).toString());
    return e1.mapToG1();
}
exports.mapToPoint = mapToPoint;
function toBigEndian(p) {
    // serialize() gets a little-endian output of Uint8Array
    // reverse() turns it into big-endian, which Solidity likes
    return p.serialize().reverse();
}
exports.toBigEndian = toBigEndian;
function g1() {
    const g1 = new mcl.G1();
    g1.setStr("1 0x01 0x02", 16);
    return g1;
}
exports.g1 = g1;
function g2() {
    const g2 = new mcl.G2();
    g2.setStr("1 0x1800deef121f1e76426a00665e5c4479674322d4f75edadd46debd5cd992f6ed 0x198e9393920d483a7260bfb731fb5d25f1aa493335a9e71297e485b7aef312c2 0x12c85ea5db8c6deb4aab71808dcb408fe3d1e7690c43d37b4ce6cc0166fa7daa 0x090689d0585ff075ec9e99ad690c3395bc4b313370b38ef355acdadcd122975b");
    return g2;
}
exports.g2 = g2;
function g1ToHex(p) {
    p.normalize();
    const x = utils_2.hexlify(toBigEndian(p.getX()));
    const y = utils_2.hexlify(toBigEndian(p.getY()));
    return [x, y];
}
exports.g1ToHex = g1ToHex;
function g2ToHex(p) {
    p.normalize();
    const x = toBigEndian(p.getX());
    const x0 = utils_2.hexlify(x.slice(32));
    const x1 = utils_2.hexlify(x.slice(0, 32));
    const y = toBigEndian(p.getY());
    const y0 = utils_2.hexlify(y.slice(32));
    const y1 = utils_2.hexlify(y.slice(0, 32));
    return [x0, x1, y0, y1];
}
exports.g2ToHex = g2ToHex;
function newKeyPair() {
    const secret = randFr();
    const mclPubkey = mcl.mul(g2(), secret);
    mclPubkey.normalize();
    const pubkey = g2ToHex(mclPubkey);
    return { pubkey, secret };
}
exports.newKeyPair = newKeyPair;
function sign(message, secret) {
    const messagePoint = hashToPoint(message);
    const signature = mcl.mul(messagePoint, secret);
    signature.normalize();
    const M = g1ToHex(messagePoint);
    return { signature, M };
}
exports.sign = sign;
function aggreagate(signatures) {
    let aggregated = new mcl.G1();
    for (const sig of signatures) {
        aggregated = mcl.add(aggregated, sig);
    }
    aggregated.normalize();
    return g1ToHex(aggregated);
}
exports.aggreagate = aggreagate;
function newG1() {
    const g1 = new mcl.G1();
    return g1ToHex(g1);
}
exports.newG1 = newG1;
function newG2() {
    const g2 = new mcl.G2();
    return g2ToHex(g2);
}
exports.newG2 = newG2;
function randFr() {
    const r = utils_1.randHex(12);
    let fr = new mcl.Fr();
    fr.setHashOf(r);
    return fr;
}
exports.randFr = randFr;
function randG1() {
    const p = mcl.mul(g1(), randFr());
    p.normalize();
    return g1ToHex(p);
}
exports.randG1 = randG1;
function randG2() {
    const p = mcl.mul(g2(), randFr());
    p.normalize();
    return g2ToHex(p);
}
exports.randG2 = randG2;
exports.getMclInstance = () => mcl;
//# sourceMappingURL=mcl.js.map