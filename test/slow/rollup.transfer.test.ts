import { deployAll } from "../../ts/deploy";
import { TESTING_PARAMS } from "../../ts/constants";
import { ethers } from "hardhat";
import { StateTree } from "../../ts/stateTree";
import { AccountRegistry } from "../../ts/accountTree";
import { serialize } from "../../ts/tx";
import * as mcl from "../../ts/mcl";
import { allContracts } from "../../ts/allContractsInterfaces";
import { assert } from "chai";
import { getGenesisProof, TransferCommitment } from "../../ts/commitments";
import { USDT } from "../../ts/decimal";
import { hexToUint8Array } from "../../ts/utils";
import { Group, txTransferFactory } from "../../ts/factory";

const DOMAIN = hexToUint8Array(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
);

describe("Rollup", async function() {
    const tokenID = 1;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let users: Group;
    let genesisRoot: string;

    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const [signer] = await ethers.getSigners();

        users = Group.new({
            n: 32,
            initialStateID: 0,
            initialPubkeyID: 0,
            domain: DOMAIN
        });

        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);

        const initialBalance = USDT.parse("55.6");
        users
            .connect(stateTree)
            .createStates({ initialBalance, tokenID, zeroNonce: true });

        genesisRoot = stateTree.root;

        contracts = await deployAll(signer, {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: genesisRoot
        });

        registry = await AccountRegistry.new(contracts.blsAccountRegistry);

        for (const user of users.userIterator()) {
            const pubkeyID = await registry.register(user.pubkey);
            assert.equal(pubkeyID, user.pubkeyID);
        }
    });

    it("submit a batch and dispute", async function() {
        const feeReceiver = users.getUser(0).stateID;
        const { rollup } = contracts;
        const { txs, signature } = txTransferFactory(
            users,
            TESTING_PARAMS.MAX_TXS_PER_COMMIT
        );

        const { proofs } = stateTree.processTransferCommit(txs, feeReceiver);

        const commitment = TransferCommitment.new(
            stateTree.root,
            registry.root(),
            signature,
            feeReceiver,
            serialize(txs)
        );

        const targetBatch = commitment.toBatch();
        const _txSubmit = await targetBatch.submit(
            rollup,
            TESTING_PARAMS.STAKE_AMOUNT
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
        const previousMP = getGenesisProof(genesisRoot);
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
    }).timeout(120000);
});
