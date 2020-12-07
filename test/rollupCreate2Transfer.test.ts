import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { serialize, TxCreate2Transfer, TxTransfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import {
    Create2TransferBatch,
    Create2TransferCommitment
} from "../ts/commitments";
import { USDT } from "../ts/decimal";
import { constants } from "ethers";
import { hexToUint8Array } from "../ts/utils";

const DOMAIN = hexToUint8Array(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

describe("Rollup Create2Transfer", async function() {
    const tokenID = 1;
    let Alice: State;
    let Bob: State;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let initialBatch: Create2TransferBatch;
    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        contracts = await deployAll(accounts[0], {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: constants.HashZero
        });
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        const initialBalance = USDT.castInt(55.6);

        Alice = State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(0);
        Alice.newKeyPair(DOMAIN);
        Alice.pubkeyID = await registry.register(Alice.getPubkey());

        Bob = State.new(-1, tokenID, initialBalance, 0);
        Bob.setStateID(1);
        Bob.newKeyPair(DOMAIN);
        Bob.pubkeyID = await registry.register(Bob.getPubkey());

        // Bob is not in the state tree before the transfer
        stateTree.createState(Alice);

        const accountRoot = await registry.root();

        const initialCommitment = Create2TransferCommitment.new(
            stateTree.root,
            accountRoot
        );
        initialBatch = initialCommitment.toBatch();
        await initialBatch.submit(
            contracts.rollup,
            TESTING_PARAMS.STAKE_AMOUNT
        );
    });

    it("submit a batch and dispute", async function() {
        const feeReceiver = Alice.stateID;
        const tx = new TxCreate2Transfer(
            Alice.stateID,
            Bob.stateID,
            Bob.getPubkey(),
            Bob.pubkeyID,
            USDT.castInt(5.5),
            USDT.castInt(0.56),
            Alice.nonce + 1,
            USDT
        );

        const rollup = contracts.rollup;
        const { proofs, safe } = stateTree.processCreate2TransferCommit(
            [tx],
            feeReceiver
        );
        assert.isTrue(safe);
        const postStateRoot = stateTree.root;
        const serialized = serialize([tx]);

        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");

        const commitment = Create2TransferCommitment.new(
            postStateRoot,
            root,
            Alice.sign(tx).sol,
            feeReceiver,
            serialized
        );

        const targetBatch = commitment.toBatch();
        const _txSubmit = await targetBatch.submit(
            rollup,
            TESTING_PARAMS.STAKE_AMOUNT
        );
        console.log(
            "submitBatch execution cost",
            await (await _txSubmit.wait()).gasUsed.toNumber()
        );

        const batchId = Number(await rollup.nextBatchID()) - 1;
        const batch = await rollup.getBatch(batchId);

        assert.equal(
            batch.commitmentRoot,
            targetBatch.commitmentRoot,
            "mismatch commitment tree root"
        );
        const previousMP = initialBatch.proofCompressed(0);
        const commitmentMP = targetBatch.proof(0);

        const _tx = await rollup.disputeTransitionCreate2Transfer(
            batchId,
            previousMP,
            commitmentMP,
            proofs
        );
        const receipt = await _tx.wait();
        console.log("disputeBatch execution cost", receipt.gasUsed.toNumber());
        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    });
});
