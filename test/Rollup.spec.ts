import { Usage } from "../scripts/helpers/interfaces";
import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "./utils/state_tree";
import { AccountRegistry } from "./utils/account_tree";
import { Account } from "./utils/state_account";
import { TxTransfer } from "./utils/tx";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";

describe("Rollup", async function() {
    let Alice: Account;
    let Bob: Account;

    let contracts: any;
    let stateTree: StateTree;
    let registry: BlsAccountRegistry;

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        contracts = deployAll(accounts[0], TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registry = contracts.blsRegistry;
        const appID =
            "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
        const tokenID = 1;
        Alice = Account.new(appID, 2, tokenID, 10, 0);
        Alice.setStateID(2);
        Alice.newKeyPair();
        await registry.register(Alice.encodePubkey());
        Bob = Account.new(appID, 3, tokenID, 10, 0);
        Bob.setStateID(3);
        Bob.newKeyPair();
        await registry.register(Bob.encodePubkey());
        stateTree.createAccount(Alice);
        stateTree.createAccount(Bob);
    });

    it("submit a batch and dispute", async function() {
        const tx = new TxTransfer(
            Alice.stateID,
            Bob.stateID,
            5,
            Alice.nonce + 1
        );

        const signature = Alice.sign(tx);

        const rollup = contracts.rollup as Rollup;
        const rollupUtils = contracts.rollupUtils as RollupUtils;
        const stateRoot = stateTree.root;
        const proof = stateTree.applyTxTransfer(tx);

        const _tx = await rollup.submitBatch(
            [tx.encode()],
            [stateRoot],
            Usage.Transfer,
            signature
        );
        await _tx.wait();

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const root = await registry.root();

        const commitment = {
            stateRoot: ethers.utils.arrayify(stateRoot),
            accountRoot: ethers.utils.arrayify(root),
            txHashCommitment: ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(["bytes"], [tx.encode()])
            ),
            batchType: Usage.Transfer
        };

        const commitmentMP = {
            commitment,
            pathToCommitment: 1,
            siblings: []
        };

        await rollup.disputeBatch(
            batchId,
            commitmentMP,
            tx.encode(),
            {} // batch proof waht???
        );
    });
});
