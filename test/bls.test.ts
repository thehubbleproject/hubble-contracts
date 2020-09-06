import { TestBlsFactory } from "../types/ethers-contracts/TestBlsFactory";
import { TestBls } from "../types/ethers-contracts/TestBls";
import { assert } from "chai";
import { randFs, FIELD_ORDER, randHex, randFsHex, bigToHex } from "../ts/utils";

import * as mcl from "../ts/mcl";
import { ethers } from "@nomiclabs/buidler";
import { randomBytes, hexlify, arrayify, zeroPad } from "ethers/lib/utils";
import { expandMsg, hashToField } from "../ts/hash_to_field";

const DOMAIN_STR = randHex(32);
const DOMAIN = Uint8Array.from(Buffer.from(DOMAIN_STR.slice(2), "hex"));

describe("BLS", async () => {
    let bls: TestBls;
    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN_STR);
        const accounts = await ethers.getSigners();
        bls = await new TestBlsFactory(accounts[0]).deploy();
        await bls.deployed();
    });
    it("map to point", async function() {
        for (let i = 0; i < 100; i++) {
            const e = randFsHex();
            let expect = mcl.g1ToHex(mcl.mapToPoint(e));
            let res = await bls.mapToPoint(e);
            assert.equal(expect[0], bigToHex(res[0]), "e " + e);
            assert.equal(expect[1], bigToHex(res[1]), "e " + e);
        }
    });
    it("expand message to 96", async function() {
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < 100; i++) {
                const msg = randomBytes(i);
                const expected = expandMsg(DOMAIN, msg, 96);
                const result = await bls.expandMsg(DOMAIN, msg);
                assert.equal(hexlify(expected), result);
            }
        }
    });
    it("hash to field", async function() {
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < 100; i++) {
                const msg = randomBytes(i);
                const expected = hashToField(DOMAIN, msg, 2);
                const result = await bls.hashToField(DOMAIN, msg);
                assert.equal(hexlify(expected[0]), hexlify(result[0]));
                assert.equal(hexlify(expected[1]), hexlify(result[1]));
            }
        }
    });
    it("hash to point", async function() {
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < 100; i++) {
                const msg = randomBytes(i);
                const expected = mcl.g1ToHex(mcl.hashToPoint(hexlify(msg)));
                const result = await bls.hashToPoint(DOMAIN, msg);
                assert.equal(expected[0], bigToHex(result[0]));
                assert.equal(expected[1], bigToHex(result[1]));
            }
        }
    });
    it("verify aggregated signature", async function() {
        const n = 10;
        const messages = [];
        const pubkeys = [];
        let aggSignature = mcl.newG1();
        for (let i = 0; i < n; i++) {
            const message = randHex(12);
            const { pubkey, secret } = mcl.newKeyPair();
            const { signature, M } = mcl.sign(message, secret);
            aggSignature = mcl.aggreagate(aggSignature, signature);
            messages.push(M);
            pubkeys.push(pubkey);
        }
        let messages_ser = messages.map(p => mcl.g1ToHex(p));
        let pubkeys_ser = pubkeys.map(p => mcl.g2ToHex(p));
        let sig_ser = mcl.g1ToHex(aggSignature);
        let res = await bls.verifyMultiple(sig_ser, pubkeys_ser, messages_ser);
        assert.isTrue(res);
    });
    it("verify single signature", async function() {
        const message = randHex(12);
        const { pubkey, secret } = mcl.newKeyPair();
        const { signature, M } = mcl.sign(message, secret);
        let message_ser = mcl.g1ToHex(M);
        let pubkey_ser = mcl.g2ToHex(pubkey);
        let sig_ser = mcl.g1ToHex(signature);
        let res = await bls.verifySingle(sig_ser, pubkey_ser, message_ser);
        assert.isTrue(res);
    });
    it("is on curve g1", async function() {
        for (let i = 0; i < 20; i++) {
            const point = mcl.randG1();
            let isOnCurve = await bls.isOnCurveG1(mcl.g1ToHex(point));
            assert.isTrue(isOnCurve);
        }
        for (let i = 0; i < 20; i++) {
            const point = [
                ethers.utils.randomBytes(31),
                ethers.utils.randomBytes(31)
            ];
            const isOnCurve = await bls.isOnCurveG1(point);
            assert.isFalse(isOnCurve);
        }
    });
    it("is on curve g2", async function() {
        for (let i = 0; i < 20; i++) {
            const point = mcl.randG2();
            let isOnCurve = await bls.isOnCurveG2(mcl.g2ToHex(point));
            assert.isTrue(isOnCurve);
        }
        for (let i = 0; i < 20; i++) {
            const point = [
                ethers.utils.randomBytes(31),
                ethers.utils.randomBytes(31),
                ethers.utils.randomBytes(31),
                ethers.utils.randomBytes(31)
            ];
            const isOnCurve = await bls.isOnCurveG2(point);
            assert.isFalse(isOnCurve);
        }
    });
    it("fp is non residue", async function() {
        const MINUS_ONE =
            "0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd46";

        let r = await bls.isNonResidueFP(MINUS_ONE);
        assert.isTrue(r);
        r = await bls.isNonResidueFP("0x04");
        assert.isFalse(r);
        const residues = [];
        for (let i = 0; i < 5; i++) {
            const a = randFs();
            residues.push(a.mul(a).mod(FIELD_ORDER));
        }
        const nonResidues = [
            "0x23d9bb51d142f4a4b8a533721a30648b5ff7f9387b43d4fc8232db20377611bc",
            "0x107662a378d9198183bd183db9f6e5ba271fbf2ec6b8b077dfc0a40119f104cb",
            "0x0df617c7a009e07c841d683108b8747a842ce0e76f03f0ce9939473d569ea4ba",
            "0x276496bfeb07b8ccfc041a1706fbe3d96f4d42ffb707edc5e31cae16690fddc7",
            "0x20fcdf224c9982c72a3e659884fdad7cb59b736d6d57d54799c57434b7869bb3"
        ];
        for (let i = 0; i < residues.length; i++) {
            r = await bls.isNonResidueFP(residues[i].toString());
            assert.isFalse(r);
        }
        for (let i = 0; i < nonResidues.length; i++) {
            r = await bls.isNonResidueFP(nonResidues[i].toString());
            assert.isTrue(r);
        }
    });
    it.skip("gas cost: verify signature", async function() {
        const n = 100;
        const messages = [];
        const pubkeys = [];
        let aggSignature = mcl.newG1();
        for (let i = 0; i < n; i++) {
            const message = randHex(12);
            const { pubkey, secret } = mcl.newKeyPair();
            const { signature, M } = mcl.sign(message, secret);
            aggSignature = mcl.aggreagate(aggSignature, signature);
            messages.push(M);
            pubkeys.push(pubkey);
        }
        let messages_ser = messages.map(p => mcl.g1ToHex(p));
        let pubkeys_ser = pubkeys.map(p => mcl.g2ToHex(p));
        let sig_ser = mcl.g1ToHex(aggSignature);
        let cost = await bls.estimateGas.verifyMultipleGasCost(
            sig_ser,
            pubkeys_ser,
            messages_ser
        );
        console.log(`verify signature for ${n} message: ${cost.toNumber()}`);
    });
    it.skip("gas cost: verify single signature", async function() {
        const message = randHex(12);
        const { pubkey, secret } = mcl.newKeyPair();
        const { signature, M } = mcl.sign(message, secret);
        let message_ser = mcl.g1ToHex(M);
        let pubkey_ser = mcl.g2ToHex(pubkey);
        let sig_ser = mcl.g1ToHex(signature);
        let cost = await bls.estimateGas.verifySingleGasCost(
            sig_ser,
            pubkey_ser,
            message_ser
        );
        console.log(`verify single signature:: ${cost.toNumber()}`);
    });
});
