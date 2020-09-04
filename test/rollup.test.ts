import { Usage } from "../ts/interfaces";
import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
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
        const rollupUtils = contracts.rollupUtils;
        const stateRoot = stateTree.root;
        const { proof, feeProof, safe } = stateTree.applyTransferBatch(
            [tx],
            feeReceiver
        );
        assert.isTrue(safe);
        const { serialized, commit } = serialize([tx]);
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const _txSubmit = await rollup.submitBatch(
            [serialized],
            [stateRoot],
            Usage.Transfer,
            [aggregatedSignature0],
            feeReceiver,
            { value: ethers.utils.parseEther(TESTING_PARAMS.STAKE_AMOUNT) }
        );
        console.log(
            "submitBatch execution cost",
            await (await _txSubmit.wait()).gasUsed.toNumber()
        );

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        const batch = await rollup.getBatch(batchId);

        const commitment = {
            stateRoot,
            accountRoot: root,
            signature: aggregatedSignature0,
            txs,
            feeReceiver,
            batchType: Usage.Transfer
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
        const leaf = await rollupUtils.CommitmentToHash(
            commitment.stateRoot,
            commitment.accountRoot,
            commitment.signature,
            commitment.txs,
            commitment.feeReceiver,
            commitment.batchType
        );
        const abiCoder = ethers.utils.defaultAbiCoder;
        const hash = ethers.utils.keccak256(
            abiCoder.encode(
                ["bytes32", "bytes32", "uint256[2]", "bytes", "uint256", "uint8"],
                [
                    commitment.stateRoot,
                    commitment.accountRoot,
                    commitment.signature,
                    commitment.txs,
                    commitment.feeReceiver,
                    commitment.batchType
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
            witness: tree.witness(0).nodes
        };

        const pathToAccount = 0; // Dummy value

        const _tx = await rollup.disputeBatch(
            batchId,
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
