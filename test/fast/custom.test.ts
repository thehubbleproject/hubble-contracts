import { assert } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { AccountRegistry } from "../../ts/accountTree";
import { aggregate, BlsSigner } from "../../ts/blsSigner";
import {
    getGenesisProof,
    TransferBatch,
    TransferCommitment
} from "../../ts/commitments";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { USDT } from "../../ts/decimal";
import { deployAll } from "../../ts/deploy";
import { StateTree } from "../../ts/stateTree";
import { serialize, TxTransfer } from "../../ts/tx";
import { hexToUint8Array } from "../../ts/utils";
import * as mcl from "../../ts/mcl";
import { State } from "../../ts/state";

describe("Custom test", async function() {
    it.only("test", async function() {
        await mcl.init();
        const parameters = PRODUCTION_PARAMS;
        parameters.MAX_DEPOSIT_SUBTREE_DEPTH = 1;
        parameters.USE_BURN_AUCTION = false;
        const stateTree = StateTree.new(parameters.MAX_DEPTH);
        const genesisRoot = stateTree.root;
        console.log("genesis state root", genesisRoot);
        const [signer] = await ethers.getSigners();
        const {
            depositManager,
            rollup,
            blsAccountRegistry,
            exampleToken
        } = await deployAll(signer, {
            ...parameters,
            GENESIS_STATE_ROOT: genesisRoot
        });
        const accountRegistry = await AccountRegistry.new(blsAccountRegistry);
        const domain = await rollup.appID();
        const blsSigner = BlsSigner.new(hexToUint8Array(domain));
        const subtreeSize = 1 << parameters.MAX_DEPOSIT_SUBTREE_DEPTH;
        console.log("subtreeSize", subtreeSize);
        const pubkeyID = await accountRegistry.register(blsSigner.pubkey);
        const balance = 100;
        const fromBlockNumber = await signer.provider?.getBlockNumber();
        await exampleToken.approve(depositManager.address, balance * 100);
        const tokenID = 0;
        // Deposit 1
        await depositManager.depositFor(pubkeyID, balance, tokenID);
        // second one is dummy
        await depositManager.depositFor(pubkeyID, balance, tokenID);
        stateTree.createState(0, State.new(pubkeyID, tokenID, balance, 0));
        stateTree.createState(1, State.new(pubkeyID, tokenID, balance, 0));
        const subtreeReadyEvents = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(null),
            fromBlockNumber
        );
        assert.equal(subtreeReadyEvents.length, 1);
        const previousProof = getGenesisProof(genesisRoot);
        const mergeOffsetLower = 0 * subtreeSize;
        const vacant = stateTree.getVacancyProof(
            mergeOffsetLower,
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );
        await rollup.submitDeposits(previousProof, vacant, {
            value: parameters.STAKE_AMOUNT
        });
        // Send transfer
        const senderStateID = 0;
        const receiverStateID = 0;
        const feeReceiverID = 0;
        const tx = new TxTransfer(
            senderStateID,
            receiverStateID,
            BigNumber.from(10),
            BigNumber.from(1),
            0,
            USDT
        );

        const signature = aggregate([blsSigner.sign(tx.message())]).sol;
        stateTree.processTransferCommit([tx], feeReceiverID);
        const commit = TransferCommitment.new(
            stateTree.root,
            accountRegistry.root(),
            signature,
            feeReceiverID,
            serialize([tx])
        );

        const batch = new TransferBatch([commit]);
        await batch.submit(rollup, parameters.STAKE_AMOUNT);
        console.log("State root", stateTree.root);
        // Deposit 2
        const fromBlockNumber2 = await signer.provider?.getBlockNumber();
        await depositManager.depositFor(pubkeyID, balance, tokenID);
        await depositManager.depositFor(pubkeyID, balance, tokenID);
        const mergeOffsetLower1 = 1 * subtreeSize;
        const vacant1 = stateTree.getVacancyProof(
            mergeOffsetLower1,
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );

        stateTree.createState(2, State.new(pubkeyID, tokenID, balance, 0));
        stateTree.createState(3, State.new(pubkeyID, tokenID, balance, 0));
        const subtreeReadyEvents2 = await depositManager.queryFilter(
            depositManager.filters.DepositSubTreeReady(null),
            fromBlockNumber2
        );
        assert.equal(subtreeReadyEvents2.length, 1);

        const previousProof2 = batch.proofCompressed(0);
        console.log("deposit 2", previousProof2);
        await rollup.submitDeposits(previousProof2, vacant1, {
            value: parameters.STAKE_AMOUNT
        });
    });
});
