import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS, ZERO_BYTES32 } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { Account } from "../ts/stateAccount";
import { serialize, TxTransfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { Tree, Hasher } from "../ts/tree";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Rollup", async function() {
    const tokenID = 1;
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

        Alice = Account.new(-1, tokenID, 10, 0);
        Alice.setStateID(0);
        Alice.newKeyPair();
        Alice.accountID = await registry.register(Alice.encodePubkey());

        Bob = Account.new(-1, tokenID, 10, 0);
        Bob.setStateID(1);
        Bob.newKeyPair();
        Bob.accountID = await registry.register(Bob.encodePubkey());

        stateTree.createAccount(Alice);
        stateTree.createAccount(Bob);

        stateTree.root
        stateTree.stateTree.witness(0, 3)
        // await contracts.rollup.finaliseDepositsAndSubmitBatch(1, )
    });

    it("submit a batch and dispute", async function() {
        const feeReceiver = Alice.stateID;
        const fee = 1;
        const tx = new TxTransfer(
            Alice.stateID,
            Bob.stateID,
            5,
            fee,
            Alice.nonce + 1
        );

        const signature = Alice.sign(tx);

        const rollup = contracts.rollup;
        const stateRoot = stateTree.root;
        const { proof, feeProof, safe } = stateTree.applyTransferBatch(
            [tx],
            feeReceiver
        );
        assert.isTrue(safe);
        const { serialized } = serialize([tx]);
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const commitment = {
            stateRoot,
            body: {
                accountRoot: ethers.constants.HashZero,
                signature: aggregatedSignature0,
                tokenType: tokenID,
                feeReceiver,
                txs: serialized
            }
        };
        const _txSubmit = await rollup.submitTransferBatch([commitment], {
            value: ethers.utils.parseEther(TESTING_PARAMS.STAKE_AMOUNT)
        });
        console.log(
            "submitBatch execution cost",
            await (await _txSubmit.wait()).gasUsed.toNumber()
        );

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        commitment.body.accountRoot = root;
        const batch = await rollup.getBatch(batchId);

        const depth = 1; // Math.log2(commitmentLength + 1)
        const tree = Tree.new(depth, Hasher.new("bytes", ZERO_BYTES32));
        const bodyRoot = ethers.utils.solidityKeccak256(
            ["bytes32", "uint256[2]", "uint256", "uint256", "bytes"],
            [
                commitment.body.accountRoot,
                commitment.body.signature,
                commitment.body.tokenType,
                commitment.body.feeReceiver,
                commitment.body.txs
            ]
        );
        const hash = ethers.utils.solidityKeccak256(
            ["bytes32", "bytes32"],
            [commitment.stateRoot, bodyRoot]
        );
        tree.updateSingle(0, hash);
        assert.equal(
            batch.commitmentRoot,
            tree.root,
            "mismatch commitment tree root"
        );
        const treeGenesis = Tree.new(depth, Hasher.new("bytes", ZERO_BYTES32));
        treeGenesis.updateSingle(
            0,
            ethers.utils.solidityKeccak256(
                ["bytes32", "bytes32"],
                [TESTING_PARAMS.GENESIS_STATE_ROOT, ZERO_BYTES32]
            )
        );
        const previousMP = {
            commitment: {
                stateRoot: TESTING_PARAMS.GENESIS_STATE_ROOT as string,
                bodyRoot: ZERO_BYTES32
            },
            pathToCommitment: 0,
            witness: treeGenesis.witness(0).nodes
        };

        const commitmentMP = {
            commitment,
            pathToCommitment: 0,
            witness: tree.witness(0).nodes
        };

        const pathToAccount = 0; // Dummy value

        const _tx = await rollup.disputeBatch(
            batchId,
            previousMP,
            commitmentMP,
            [
                {
                    pathToAccount,
                    account: proof[0].senderAccount,
                    siblings: proof[0].senderWitness
                },
                {
                    pathToAccount,
                    account: proof[0].receiverAccount,
                    siblings: proof[0].receiverWitness
                },
                {
                    pathToAccount,
                    account: feeProof.feeReceiverAccount,
                    siblings: feeProof.feeReceiverWitness
                }
            ]
        );
        const receipt = await _tx.wait();
        console.log("disputeBatch execution cost", receipt.gasUsed.toNumber());
    });
});
