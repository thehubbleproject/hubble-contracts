import { Usage } from "../ts/interfaces";
import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { Account } from "../ts/stateAccount";
import { TxMassMigration } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { Tree, Hasher } from "../ts/tree";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Mass Migrations", async function() {
    let Alice: Account;
    let Bob: Account;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
    });

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        contracts = await deployAll(accounts[0], TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        const tokenID = 1;

        Alice = Account.new(-1, tokenID, 10, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        Alice.accountID = await registry.register(Alice.encodePubkey());

        Bob = Account.new(-1, tokenID, 10, 0);
        Bob.setStateID(3);
        Bob.newKeyPair();
        Bob.accountID = await registry.register(Bob.encodePubkey());

        stateTree.createAccount(Alice);
        stateTree.createAccount(Bob);
    });

    it("submit a batch and dispute", async function() {
        const tx = new TxMassMigration(
            Alice.stateID,
            0,
            5,
            1,
            1,
            Alice.nonce + 1
        );
        const signature = Alice.sign(tx);
        const rollup = contracts.rollup;
        const stateRoot = stateTree.root;
        const proof = stateTree.applyMassMigration(tx);
        const txs = ethers.utils.arrayify(tx.encode(true));
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const root = await registry.root();

        const commitment = {
            stateRoot,
            body: {
                accountRoot: root,
                signature: aggregatedSignature0,
                targetSpokeID: tx.spokeID,
                withdrawRoot:
                    "0x0000000000000000000000000000000000000000000000000000000000000000",
                tokenID: 1,
                amount: tx.amount,
                txs
            }
        };
        const {
            0: postStateRoot
        } = await contracts.massMigration.processMassMigrationCommit(
            commitment,
            [
                {
                    pathToAccount: Alice.stateID,
                    account: proof.account,
                    siblings: proof.witness
                }
            ]
        );
        commitment.stateRoot = postStateRoot;

        await rollup.submitBatchWithMM(commitment, {
            value: ethers.utils.parseEther(TESTING_PARAMS.STAKE_AMOUNT)
        });

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        const batch = await rollup.getBatch(batchId);
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

        const bodyRoot = ethers.utils.solidityKeccak256(
            [
                "bytes32",
                "uint256[2]",
                "uint256",
                "bytes32",
                "uint256",
                "uint256",
                "bytes"
            ],
            [
                commitment.body.accountRoot,
                commitment.body.signature,
                commitment.body.targetSpokeID,
                commitment.body.withdrawRoot,
                commitment.body.tokenID,
                commitment.body.amount,
                commitment.body.txs
            ]
        );

        const leaf = ethers.utils.solidityKeccak256(
            ["bytes32", "bytes32"],
            [commitment.stateRoot, bodyRoot]
        );

        tree.updateSingle(0, leaf);
        assert.equal(
            batch.commitmentRoot,
            tree.root,
            "mismatch commitment tree root"
        );

        const witness: string[] = [];
        const previousMP = {
            commitment: {
                stateRoot: "",
                bodyRoot: ""
            },
            pathToCommitment: 0,
            witness
        };

        const commitmentMP = {
            commitment,
            pathToCommitment: 0,
            siblings: tree.witness(0).nodes
        };

        await rollup.disputeMMBatch(batchId, previousMP, commitmentMP, [
            {
                pathToAccount: Alice.stateID,
                account: proof.account,
                siblings: proof.witness
            }
        ]);
    });
});
