import { Usage } from "../scripts/helpers/interfaces";
import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "./utils/state_tree";
import { AccountRegistry2 } from "./utils/account_tree";
import { Account } from "./utils/state_account";
import { TxTransfer } from "./utils/tx";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import * as mcl from "./utils/mcl";

describe("Rollup", async function() {
    let Alice: Account;
    let Bob: Account;

    let contracts: any;
    let stateTree: StateTree;
    let registry: AccountRegistry2;
    before(async function() {
        await mcl.init();
    });

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        contracts = await deployAll(accounts[0], TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        const registry = await AccountRegistry2.new(registryContract);
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
        const stateRoot = ethers.utils.arrayify(stateTree.root);
        const proof = stateTree.applyTxTransfer(tx);
        const txs = ethers.utils.arrayify("0x" + tx.encode());

        const _tx = await rollup.submitBatch(
            [txs],
            [stateRoot],
            Usage.Transfer,
            [mcl.g1ToHex(signature)],
            { value: TESTING_PARAMS.STAKE_AMOUNT }
        );
        await _tx.wait();
        console.log("HERE");

        const batchId = Number(await rollup.numOfBatchesSubmitted()) - 1;
        const root = await registry.root();

        const commitment = {
            stateRoot,
            accountRoot: ethers.utils.arrayify(root),
            txHashCommitment: ethers.utils.arrayify(
                ethers.utils.solidityKeccak256(["bytes"], [txs])
            ),
            batchType: Usage.Transfer
        };

        const commitmentMP = {
            commitment,
            pathToCommitment: 1,
            siblings: []
        };

        await rollup.disputeBatch(batchId, commitmentMP, txs, {
            accountProofs: [
                {
                    from: {
                        accountIP: {
                            pathToAccount: Alice.stateID,
                            account: proof.senderAccount
                        },
                        siblings: proof.senderWitness.map(ethers.utils.arrayify)
                    },
                    to: {
                        accountIP: {
                            pathToAccount: Bob.stateID,
                            account: proof.receiverAccount
                        },
                        siblings: proof.receiverWitness.map(
                            ethers.utils.arrayify
                        )
                    }
                }
            ],
            pdaProof: [
                {
                    _pda: {
                        pathToPubkey: Alice.accountID,
                        pubkey_leaf: {
                            pubkey: mcl.g2ToHex(Alice.publicKey)
                        }
                    },
                    siblings: registry
                        .witness(Alice.accountID)
                        .map(ethers.utils.arrayify)
                }
            ]
        });
    });
});
