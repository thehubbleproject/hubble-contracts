import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { serialize, TxTransfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { TransferBatch, TransferCommitment } from "../ts/commitments";
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
    let initialBatch: TransferBatch;
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
        const initialBalance = USDT.castInt(55.6);

        Alice = State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(0);
        Alice.newKeyPair();
        Alice.pubkeyIndex = await registry.register(Alice.encodePubkey());

        Bob = State.new(-1, tokenID, initialBalance, 0);
        Bob.setStateID(1);
        Bob.newKeyPair();
        Bob.pubkeyIndex = await registry.register(Bob.encodePubkey());

        stateTree.createAccount(Alice);
        stateTree.createAccount(Bob);

        const accountRoot = await registry.root();

        const initialCommitment = TransferCommitment.new(
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
        const tx = new TxTransfer(
            Alice.stateID,
            Bob.stateID,
            USDT.castInt(5.5),
            USDT.castInt(0.56),
            Alice.nonce + 1,
            USDT
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

        const root = await registry.root();
        const rootOnchain = await registry.registry.root();
        assert.equal(root, rootOnchain, "mismatch pubkey tree root");

        const commitment = TransferCommitment.new(
            postStateRoot,
            root,
            aggregatedSignature0,
            tokenID,
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

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const batch = await rollup.getBatch(batchId);

        assert.equal(
            batch.commitmentRoot,
            targetBatch.commitmentRoot,
            "mismatch commitment tree root"
        );
        const previousMP = initialBatch.proofCompressed(0);
        const commitmentMP = targetBatch.proof(0);

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
