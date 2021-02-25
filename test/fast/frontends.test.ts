import { ethers } from "hardhat";
import { Group, User } from "../../ts/factory";
import { TxCreate2Transfer, TxMassMigration, TxTransfer } from "../../ts/tx";
import { expectCallRevert, randHex } from "../../ts/utils";
import * as mcl from "../../ts/mcl";
import { deployKeyless } from "../../ts/deployment/deploy";
import {
    FrontendCreate2TransferFactory,
    FrontendMassMigrationFactory,
    FrontendTransferFactory
} from "../../types/ethers-contracts";
import { Signer } from "ethers";
import { assert } from "chai";
import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { allContracts } from "../../ts/allContractsInterfaces";
import { arrayify } from "ethers/lib/utils";
import { ERC20ValueFactory } from "../../ts/decimal";

const domain = arrayify(randHex(32));

describe("Frontend", function() {
    let user: User;
    let badSig: mcl.solG1;
    let signer: Signer;

    before(async function() {
        await mcl.init();
        [signer] = await ethers.getSigners();
        user = User.new(0, 0, domain);
        badSig = user.signRaw("0xf00d").sol;
    });
    beforeEach(async function() {
        // Reset to the state before pairing gas estimator is deployed
        await ethers.provider.send("hardhat_reset", []);
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

describe("Frontend Utilities", function() {
    let signer: Signer;
    let contracts: allContracts;
    let group: Group;
    before(async function() {
        await mcl.init();
        [signer] = await ethers.getSigners();
        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: randHex(32)
        });
        group = Group.new({ n: 20, domain });
    });
    it("register and deposit", async function() {
        const { frontendUtilities, exampleToken, depositManager } = contracts;
        const tokenID = 0;
        const erc20 = new ERC20ValueFactory(await exampleToken.decimals());
        // The deploy contract has deploy and registered exampleToken in tokenID 0
        await exampleToken.approve(
            depositManager.address,
            erc20.fromHumanValue("1000").l1Value
        );
        await frontendUtilities.deposit(
            group.getUser(0).pubkey,
            erc20.fromHumanValue("10").l1Value,
            tokenID
        );
    });
    it("register and deposit multiple", async function() {
        const { frontendUtilities, exampleToken, depositManager } = contracts;
        const tokenID = 0;
        const erc20 = new ERC20ValueFactory(await exampleToken.decimals());
        // The deploy contract has deploy and registered exampleToken in tokenID 0
        await exampleToken.approve(
            depositManager.address,
            erc20.fromHumanValue("1000").l1Value
        );
        await frontendUtilities.depositMultiple(
            group.getPubkeys(),
            erc20.fromHumanValue("10").l1Value,
            tokenID
        );
    });
});
