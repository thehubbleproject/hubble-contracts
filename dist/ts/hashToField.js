"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandMsg = exports.hashToField = exports.FIELD_ORDER = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
exports.FIELD_ORDER = ethers_1.BigNumber.from("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
function hashToField(domain, msg, count) {
    const u = 48;
    const _msg = expandMsg(domain, msg, count * u);
    const els = [];
    for (let i = 0; i < count; i++) {
        const el = ethers_1.BigNumber.from(_msg.slice(i * u, (i + 1) * u)).mod(exports.FIELD_ORDER);
        els.push(el);
    }
    return els;
}
exports.hashToField = hashToField;
function expandMsg(domain, msg, outLen) {
    if (domain.length > 32) {
        throw new Error("bad domain size");
    }
    const out = new Uint8Array(outLen);
    const len0 = 64 + msg.length + 2 + 1 + domain.length + 1;
    const in0 = new Uint8Array(len0);
    // zero pad
    let off = 64;
    // msg
    in0.set(msg, off);
    off += msg.length;
    // l_i_b_str
    in0.set([(outLen >> 8) & 0xff, outLen & 0xff], off);
    off += 2;
    // I2OSP(0, 1)
    in0.set([0], off);
    off += 1;
    // DST_prime
    in0.set(domain, off);
    off += domain.length;
    in0.set([domain.length], off);
    const b0 = utils_1.sha256(in0);
    const len1 = 32 + 1 + domain.length + 1;
    const in1 = new Uint8Array(len1);
    // b0
    in1.set(utils_1.arrayify(b0), 0);
    off = 32;
    // I2OSP(1, 1)
    in1.set([1], off);
    off += 1;
    // DST_prime
    in1.set(domain, off);
    off += domain.length;
    in1.set([domain.length], off);
    const b1 = utils_1.sha256(in1);
    // b_i = H(strxor(b_0, b_(i - 1)) || I2OSP(i, 1) || DST_prime);
    const ell = Math.floor((outLen + 32 - 1) / 32);
    let bi = b1;
    for (let i = 1; i < ell; i++) {
        const ini = new Uint8Array(32 + 1 + domain.length + 1);
        const nb0 = utils_1.zeroPad(utils_1.arrayify(b0), 32);
        const nbi = utils_1.zeroPad(utils_1.arrayify(bi), 32);
        const tmp = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            tmp[i] = nb0[i] ^ nbi[i];
        }
        ini.set(tmp, 0);
        let off = 32;
        ini.set([1 + i], off);
        off += 1;
        ini.set(domain, off);
        off += domain.length;
        ini.set([domain.length], off);
        out.set(utils_1.arrayify(bi), 32 * (i - 1));
        bi = utils_1.sha256(ini);
    }
    out.set(utils_1.arrayify(bi), 32 * (ell - 1));
    return out;
}
exports.expandMsg = expandMsg;
//# sourceMappingURL=hashToField.js.map