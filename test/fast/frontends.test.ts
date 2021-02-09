import { ethers } from "hardhat";
import { User } from "../../ts/factory";
import { TxCreate2Transfer, TxMassMigration, TxTransfer } from "../../ts/tx";
import { expectCallRevert, hexToUint8Array, randHex } from "../../ts/utils";
import * as mcl from "../../ts/mcl";
import { deployKeyless } from "../../ts/deployment/deploy";
import {
    FrontendCreate2TransferFactory,
    FrontendMassMigrationFactory,
    FrontendTransferFactory
} from "../../types/ethers-contracts";
import { Signer } from "ethers";
import { assert } from "chai";
import { arrayify, hexlify } from "ethers/lib/utils";

describe("Frontend", function() {
    let user: User;
    let badSig: mcl.solG1;
    let signer: Signer;
    const domain = randHex(32);
    before(async function() {
        await mcl.init();
        [signer] = await ethers.getSigners();
        user = User.new(0, 0, hexToUint8Array(domain));
        badSig = user.signRaw("0xf00d").sol;
    });
    beforeEach(async function() {
        // Reset to the state before pairing gas estimator is deployed
        await ethers.provider.send("hardhat_reset", []);
    });
    it.only("debug frontendTransfer", async function() {

        const contract = await new FrontendTransferFactory(signer).deploy();
        // deploying pairing gas estimator
        await deployKeyless(signer, false);
        const DOMAIN = arrayify(
            "0x0000000000000000000000000000000000000000000000000000000000000000"
        );

        const msg = "0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000"
        const sig = "0x2503ea54859917dd83a7d1901539a4339dcd93115f4a40e80146a5b2b4931bf0166467baa4123a010d36b50cf1e669b2497d3ed0ee1b3e97a5501cae2694ab71"
        const pubkey = "0x1bf9007952179170230ecba116ab235d381b9456c5cafa88797b7ed4b7369f26093010d2d971651901219f61dbb7cec96fe77b7d690a6924f5a17ca563772e752a409027360fbaeb96797595d20e0bb3a7faf388696d532e0acf07040dac04c01b347f8d4cddeb987d32dd7032b05d5f5bde2d22a58cdd669013cccbfb1da516"
        const sigSol = [arrayify(sig).slice(0, 32), arrayify(sig).slice(32, 64)].map(x=>hexlify(x))
        const pubkeySol = [arrayify(pubkey).slice(0, 32), arrayify(pubkey).slice(32, 64), arrayify(pubkey).slice(64, 96), arrayify(pubkey).slice(96, 128)].map(x=>hexlify(x))

        // Success for having pairing gas estimator
        assert.isTrue(await contract.validate(
            msg,
            sigSol,
            pubkeySol,
            DOMAIN
        ));
    });
    it("frontendTransfer", async function() {
        const txTransfer = TxTransfer.rand();

        const contract = await new FrontendTransferFactory(signer).deploy();
        const goodArgsCall = async () => {
            return await contract.validate(
                txTransfer.encodeOffchain(),
                user.sign(txTransfer).sol,
                user.pubkey,
                domain
            );
        };
        // Failing for no pairing gas estimator
        await expectCallRevert(goodArgsCall(), null);

        // deploying pairing gas estimator
        await deployKeyless(signer, false);

        // Success for having pairing gas estimator
        assert.isTrue(await goodArgsCall());

        await expectCallRevert(
            contract.validate(
                txTransfer.encodeOffchain(),
                badSig,
                user.pubkey,
                domain
            ),
            "Bad signature"
        );
    });
    it("frontendMassMigration", async function() {
        const txMassMigration = TxMassMigration.rand();
        const contract = await new FrontendMassMigrationFactory(
            signer
        ).deploy();
        const goodArgsCall = async () => {
            return await contract.validate(
                txMassMigration.encodeOffchain(),
                user.sign(txMassMigration).sol,
                user.pubkey,
                domain
            );
        };
        await expectCallRevert(goodArgsCall(), null);
        await deployKeyless(signer, false);
        assert.isTrue(await goodArgsCall());
        await expectCallRevert(
            contract.validate(
                txMassMigration.encodeOffchain(),
                badSig,
                user.pubkey,
                domain
            ),
            "Bad signature"
        );
    });
    it("frontendCreate2Transfer", async function() {
        const txCreate2Transfer = TxCreate2Transfer.rand();
        const contract = await new FrontendCreate2TransferFactory(
            signer
        ).deploy();
        const goodArgsCall = async () => {
            return await contract.validate(
                txCreate2Transfer.encodeOffchain(),
                user.sign(txCreate2Transfer).sol,
                user.pubkey,
                txCreate2Transfer.toPubkey,
                domain
            );
        };
        await expectCallRevert(goodArgsCall(), null);
        await deployKeyless(signer, false);
        assert.isTrue(await goodArgsCall());
        await expectCallRevert(
            contract.validate(
                txCreate2Transfer.encodeOffchain(),
                badSig,
                user.pubkey,
                txCreate2Transfer.toPubkey,
                domain
            ),
            "Bad signature"
        );
    });
});
