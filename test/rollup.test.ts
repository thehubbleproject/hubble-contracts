import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { Account } from "../ts/stateAccount";
import { serialize, TxTransfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { CommitmentTree, TransferCommitment } from "../ts/commitments";

const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Rollup", async function() {
    const tokenID = 1;
    let Alice: Account;
    let Bob: Account;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let initialCommitmentTree: CommitmentTree;
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

        const accountRoot = await registry.root();

        const initialCommitment = TransferCommitment.new(
            stateTree.root,
            accountRoot
        );
        // We submit a batch that has a stateRoot containing Alice and Bob
        await contracts.rollup.submitTransferBatch(
            [initialCommitment.toSolStruct()],
            {
                value: ethers.utils.parseEther(TESTING_PARAMS.STAKE_AMOUNT)
            }
        );
        initialCommitmentTree = new CommitmentTree([initialCommitment]);
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
        const { proof, feeProof, safe } = stateTree.applyTransferBatch(
            [tx],
            feeReceiver
        );
        assert.isTrue(safe);
        const postStateRoot = stateTree.root;
        const { serialized } = serialize([tx]);
        const aggregatedSignature0 = mcl.g1ToHex(signature);
        const commitment = TransferCommitment.new(
            postStateRoot,
            ethers.constants.HashZero,
            aggregatedSignature0,
            tokenID,
            feeReceiver,
            serialized
        );
        const _txSubmit = await rollup.submitTransferBatch(
            [commitment.toSolStruct()],
            {
                value: ethers.utils.parseEther(TESTING_PARAMS.STAKE_AMOUNT)
            }
        );
        console.log(
            "submitBatch execution cost",
            await (await _txSubmit.wait()).gasUsed.toNumber()
        );

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");
        commitment.accountRoot = root;
        const commitmentTree = new CommitmentTree([commitment]);

        const batch = await rollup.getBatch(batchId);

        assert.equal(
            batch.commitmentRoot,
            commitmentTree.root,
            "mismatch commitment tree root"
        );
        const previousMP = initialCommitmentTree.proofCompressed(0);
        const commitmentMP = commitmentTree.proof(0);

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
        assert.equal(
            (await rollup.invalidBatchMarker()).toNumber(),
            0,
            "Good state transition should not rollback"
        );
    });
});
