import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { serialize, TxTransfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { getGenesisProof, TransferCommitment } from "../ts/commitments";
import { USDT } from "../ts/decimal";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Rollup", async function() {
    const tokenID = 1;
    let Alice: State;
    let Bob: State;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let parameters = TESTING_PARAMS;
    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();

        const initialBalance = USDT.castInt(55.6);
        // We build state tree first for genesis state root, then register public keys later
        Alice = State.new(0, tokenID, initialBalance, 0);
        Alice.setStateID(0);
        Alice.newKeyPair();
        Bob = State.new(1, tokenID, initialBalance, 0);
        Bob.setStateID(1);
        Bob.newKeyPair();
        stateTree = new StateTree(parameters.MAX_DEPTH);
        stateTree.createStateBulk([Alice, Bob]);

        parameters.GENESIS_STATE_ROOT = stateTree.root;

        contracts = await deployAll(signer, parameters);
        registry = await AccountRegistry.new(contracts.blsAccountRegistry);
        const AlicePubkeyID = await registry.register(Alice.getPubkey());
        const BobPubkeyID = await registry.register(Bob.getPubkey());

        assert.equal(AlicePubkeyID, Alice.pubkeyID);
        assert.equal(BobPubkeyID, Bob.pubkeyID);
    });

    it("submit a batch and dispute", async function() {
        const feeReceiver = Alice.stateID;
        const tx = new TxTransfer(
            Alice.stateID,
            Bob.stateID,
            USDT.castInt(5.5),
            USDT.castInt(0.56),
            Alice.nonce + 1,
            USDT
        );

        const { rollup } = contracts;
        const { proofs, safe } = stateTree.processTransferCommit(
            [tx],
            feeReceiver
        );
        assert.isTrue(safe);

        const commitment = TransferCommitment.new(
            stateTree.root,
            registry.root(),
            mcl.g1ToHex(Alice.sign(tx)),
            feeReceiver,
            serialize([tx])
        );

        const targetBatch = commitment.toBatch();
        const _txSubmit = await targetBatch.submit(
            rollup,
            parameters.STAKE_AMOUNT
        );
        console.log(
            "submitBatch execution cost",
            (await _txSubmit.wait()).gasUsed.toNumber()
        );

        const batchId = Number(await rollup.nextBatchID()) - 1;
        const batch = await rollup.getBatch(batchId);

        assert.equal(
            batch.commitmentRoot,
            targetBatch.commitmentRoot,
            "mismatch commitment tree root"
        );
        const previousMP = getGenesisProof(
            parameters.GENESIS_STATE_ROOT as string
        );
        const commitmentMP = targetBatch.proof(0);

        const _tx = await rollup.disputeTransitionTransfer(
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
