import { Usage } from "../ts/interfaces";
import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/state_tree";
import { AccountRegistry } from "../ts/account_tree";
import { Account } from "../ts/state_account";
import { TxMassMig } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { Tree, Hasher } from "../ts/tree";
import { allContracts } from "../ts/all-contracts-interfaces";
import { assert } from "chai";

describe("Rollup", async function () {
    let Alice: Account;
    let Bob: Account;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    before(async function () {
        await mcl.init();
    });

    beforeEach(async function () {
        const accounts = await ethers.getSigners();
        contracts = await deployAll(accounts[0], TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        const appID =
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const tokenID = 1;

        Alice = Account.new(appID, -1, tokenID, 10, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        Alice.accountID = await registry.register(Alice.encodePubkey());

        Bob = Account.new(appID, -1, tokenID, 10, 0);
        Bob.setStateID(3);
        Bob.newKeyPair();
        Bob.accountID = await registry.register(Bob.encodePubkey());

        stateTree.createAccount(Alice);
        stateTree.createAccount(Bob);
    });

    it("submit a batch and dispute", async function () {
        const tx = new TxMassMig(
            Alice.stateID,
            Bob.stateID,
            5,
            1,
            1,
            Alice.nonce + 1
        );

        const signature = Alice.sign(tx);

        const rollup = contracts.rollup;
        const rollupUtils = contracts.rollupUtils;
        const stateRoot = stateTree.root;
        const proof = stateTree.applyTxTransfer(tx);
        const txs = ethers.utils.arrayify(tx.encode(true));
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const MMInfo = {
            targetSpokeID: 1,
            withdrawRoot:
                "0x0000000000000000000000000000000000000000000000000000000000000000",
            tokenID: 1,
            amount: tx.amount,
        };
        const _tx = await rollup.submitBatchWithMM(
            [txs],
            [stateRoot],
            [aggregatedSignature0],
            [MMInfo],
            { value: ethers.utils.parseEther(TESTING_PARAMS.STAKE_AMOUNT) }
        );

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        const batch = await rollup.getBatch(batchId);

        const commitment = {
            stateRoot,
            accountRoot: root,
            txHashCommitment: ethers.utils.solidityKeccak256(["bytes"], [txs]),
            aggregatedSignature: aggregatedSignature0,
            massMigrationMetaInfo: {
                MMInfo,
            },
            batchType: Usage.MassMigration,
        };
        const depth = 1; // Math.log2(commitmentLength + 1)
        const tree = Tree.new(
            depth,
            Hasher.new(
                "bytes",
                ethers.utils.keccak256(
                    "0x0000000000000000000000000000000000000000000000000000000000000000"
                )
            )
        );
        const leaf = await rollupUtils.MMCommitmentToHash(
            commitment.stateRoot,
            commitment.accountRoot,
            commitment.txHashCommitment,
            commitment.MMInfo.tokenID,
            commitment.MMInfo.amount,
            commitment.MMInfo.withhdrawRoot,
            commitment.MMInfo.spokeID,
            aggregatedSignature0
        );
        const abiCoder = ethers.utils.defaultAbiCoder;
        const hash = ethers.utils.keccak256(
            abiCoder.encode(
                [
                    "bytes32",
                    "bytes32",
                    "bytes32",
                    "uint256",
                    "uint256",
                    "bytes32",
                    "uint256",
                    "uint256[2]",
                    "uint8",
                ],
                [
                    commitment.stateRoot,
                    commitment.accountRoot,
                    commitment.txHashCommitment,
                    commitment.MMInfo.tokenID,
                    commitment.MMInfo.amount,
                    commitment.MMInfo.withhdrawRoot,
                    commitment.MMInfo.spokeID,
                    commitment.signature,
                    commitment.batchType,
                ]
            )
        );
        assert.equal(hash, leaf, "mismatch commitment hash");
        tree.updateSingle(0, hash);
        assert.equal(
            batch.commitmentRoot,
            tree.root,
            "mismatch commitment tree root"
        );

        const commitmentMP = {
            commitment,
            pathToCommitment: 0,
            siblings: tree.witness(0).nodes,
        };

        await rollup.disputeMMBatch(batchId, commitmentMP, txs, [
            {
                pathToAccount: Alice.stateID,
                account: proof.senderAccount,
                siblings: proof.senderWitness,
            },
            {
                pathToAccount: Bob.stateID,
                account: proof.receiverAccount,
                siblings: proof.receiverWitness,
            },
        ]);
    });
});
