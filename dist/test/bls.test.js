"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const TestBlsFactory_1 = require("../types/ethers-contracts/TestBlsFactory");
const chai_1 = require("chai");
const utils_1 = require("../ts/utils");
const mcl = __importStar(require("../ts/mcl"));
const buidler_1 = require("@nomiclabs/buidler");
const utils_2 = require("ethers/lib/utils");
const hashToField_1 = require("../ts/hashToField");
const DOMAIN_HEX = utils_1.randHex(32);
const DOMAIN = utils_2.arrayify(DOMAIN_HEX);
describe("BLS", async () => {
    let bls;
    before(async function () {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_HEX);
        const accounts = await buidler_1.ethers.getSigners();
        bls = await new TestBlsFactory_1.TestBlsFactory(accounts[0]).deploy();
        await bls.deployed();
    });
    it("map to point", async function () {
        for (let i = 0; i < 100; i++) {
            const e = utils_1.randFs();
            const [expectX, expectY] = mcl.g1ToHex(mcl.mapToPoint(e));
            const [actualX, actualY] = await bls.mapToPoint(e);
            chai_1.assert.equal(utils_1.to32Hex(actualX), expectX, "e " + e);
            chai_1.assert.equal(utils_1.to32Hex(actualY), expectY, "e " + e);
        }
    });
    it("expand message to 96", async function () {
        for (let i = 0; i < 100; i++) {
            const msg = utils_2.randomBytes(i);
            const expected = hashToField_1.expandMsg(DOMAIN, msg, 96);
            const result = await bls.expandMsg(DOMAIN, msg);
            chai_1.assert.equal(result, utils_2.hexlify(expected));
        }
    });
    it("hash to field", async function () {
        for (let i = 0; i < 100; i++) {
            const msg = utils_2.randomBytes(i);
            const [expectX, expectY] = hashToField_1.hashToField(DOMAIN, msg, 2);
            const [actualX, actualY] = await bls.hashToField(DOMAIN, msg);
            chai_1.assert.equal(actualX.toHexString(), expectX.toHexString());
            chai_1.assert.equal(actualY.toHexString(), expectY.toHexString());
        }
    });
    it("hash to point", async function () {
        for (let i = 0; i < 100; i++) {
            const msg = utils_1.randHex(i);
            const [expectX, expectY] = mcl.g1ToHex(mcl.hashToPoint(msg));
            const [actualX, actualY] = await bls.hashToPoint(DOMAIN, msg);
            chai_1.assert.equal(utils_1.to32Hex(actualX), expectX);
            chai_1.assert.equal(utils_1.to32Hex(actualY), expectY);
        }
    });
    it("verify aggregated signature", async function () {
        const n = 10;
        const messages = [];
        const pubkeys = [];
        const signatures = [];
        for (let i = 0; i < n; i++) {
            const message = utils_1.randHex(12);
            const { pubkey, secret } = mcl.newKeyPair();
            const { signature, M } = mcl.sign(message, secret);
            messages.push(M);
            pubkeys.push(pubkey);
            signatures.push(signature);
        }
        const aggSignature = mcl.aggreagate(signatures);
        let res = await bls.verifyMultiple(aggSignature, pubkeys, messages);
        chai_1.assert.isTrue(res);
    });
    it("verify single signature", async function () {
        const message = utils_1.randHex(12);
        const { pubkey, secret } = mcl.newKeyPair();
        const { signature, M } = mcl.sign(message, secret);
        let res = await bls.verifySingle(mcl.g1ToHex(signature), pubkey, M);
        chai_1.assert.isTrue(res);
    });
    it("is on curve g1", async function () {
        for (let i = 0; i < 20; i++) {
            const point = mcl.randG1();
            let isOnCurve = await bls.isOnCurveG1(point);
            chai_1.assert.isTrue(isOnCurve);
        }
        for (let i = 0; i < 20; i++) {
            const point = [utils_2.randomBytes(31), utils_2.randomBytes(31)];
            const isOnCurve = await bls.isOnCurveG1(point);
            chai_1.assert.isFalse(isOnCurve);
        }
    });
    it("is on curve g2", async function () {
        for (let i = 0; i < 20; i++) {
            const point = mcl.randG2();
            let isOnCurve = await bls.isOnCurveG2(point);
            chai_1.assert.isTrue(isOnCurve);
        }
        for (let i = 0; i < 20; i++) {
            const point = [
                utils_2.randomBytes(31),
                utils_2.randomBytes(31),
                utils_2.randomBytes(31),
                utils_2.randomBytes(31)
            ];
            const isOnCurve = await bls.isOnCurveG2(point);
            chai_1.assert.isFalse(isOnCurve);
        }
    });
    it.skip("gas cost: verify signature", async function () {
        const n = 100;
        const messages = [];
        const pubkeys = [];
        const signatures = [];
        for (let i = 0; i < n; i++) {
            const message = utils_1.randHex(12);
            const { pubkey, secret } = mcl.newKeyPair();
            const { signature, M } = mcl.sign(message, secret);
            messages.push(M);
            pubkeys.push(pubkey);
            signatures.push(signature);
        }
        const aggSignature = mcl.aggreagate(signatures);
        const cost = await bls.callStatic.verifyMultipleGasCost(aggSignature, pubkeys, messages);
        console.log(`verify signature for ${n} message: ${cost.toNumber()}`);
    });
    it.skip("gas cost: verify single signature", async function () {
        const message = utils_1.randHex(12);
        const { pubkey, secret } = mcl.newKeyPair();
        const { signature, M } = mcl.sign(message, secret);
        const cost = await bls.callStatic.verifySingleGasCost(mcl.g1ToHex(signature), pubkey, M);
        console.log(`verify single signature:: ${cost.toNumber()}`);
    });
});
//# sourceMappingURL=bls.test.js.map