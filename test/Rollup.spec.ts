import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import {
    Transaction,
    ErrorCode,
    Usage,
    Account,
    Wallet,
    Dispute
} from "../scripts/helpers/interfaces";
import { StakingAmountString } from "../scripts/helpers/constants";
import { PublicKeyStore, StateStore } from "../scripts/helpers/store";
import { MAX_DEPTH } from "../scripts/helpers/constants";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const RollupReddit = artifacts.require("RollupReddit");

contract("Rollup", async function(accounts) {
    let wallets: Wallet[];

    let depositManagerInstance: any;
    let testTokenInstance: any;
    let rollupCoreInstance: any;
    let MTutilsInstance: any;
    let RollupUtilsInstance: any;
    let tokenRegistryInstance: any;
    let IMTInstance: any;
    let RollupRedditInstance: any;

    let Alice: any;
    let Bob: any;

    let coordinator_leaves: any;
    let coordinatorPubkeyHash: any;
    var zeroHashes: any;

    let falseBatchZero: Dispute;
    let falseBatchOne: any;
    let falseBatchTwo: any;
    let falseBatchThree: any;
    let falseBatchFour: any;
    let falseBatchFive: any;
    let falseBatchComb: any;

    let AlicePDAsiblings: any;

    let BobPDAsiblings: any;

    let alicePDAProof: any;
    let pubkeyStore: PublicKeyStore;
    let stateStore: StateStore;

    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
        depositManagerInstance = await DepositManager.deployed();
        testTokenInstance = await TestToken.deployed();
        rollupCoreInstance = await RollupCore.deployed();
        MTutilsInstance = await utils.getMerkleTreeUtils();
        RollupUtilsInstance = await RollupUtils.deployed();
        tokenRegistryInstance = await utils.getTokenRegistry();
        IMTInstance = await IMT.deployed();
        RollupRedditInstance = await RollupReddit.deployed();

        Alice = {
            Address: wallets[0].getAddressString(),
            Pubkey: wallets[0].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 2,
            Path: "2",
            nonce: 0
        };
        Bob = {
            Address: wallets[1].getAddressString(),
            Pubkey: wallets[1].getPublicKeyString(),
            Amount: 10,
            TokenType: 1,
            AccID: 3,
            Path: "3",
            nonce: 0
        };

        coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
        coordinatorPubkeyHash =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
        zeroHashes = await utils.defaultHashes(MAX_DEPTH);

        stateStore = new StateStore(MAX_DEPTH);
        stateStore.insertHash(coordinator_leaves[0]);
        stateStore.insertHash(coordinator_leaves[1]);

        pubkeyStore = new PublicKeyStore(MAX_DEPTH);
        pubkeyStore.insertHash(coordinator_leaves[0]);
        pubkeyStore.insertHash(coordinator_leaves[1]);
        pubkeyStore.insertPublicKey(Alice.Pubkey);
        pubkeyStore.insertPublicKey(Bob.Pubkey);

        AlicePDAsiblings = [
            utils.PubKeyHash(Bob.Pubkey),
            utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
            zeroHashes[2],
            zeroHashes[3]
        ];

        BobPDAsiblings = [
            utils.PubKeyHash(Alice.Pubkey),
            utils.getParentLeaf(
                coordinatorPubkeyHash,
                utils.PubKeyHash(Alice.Pubkey)
            ),
            zeroHashes[2],
            zeroHashes[3]
        ];

        alicePDAProof = {
            _pda: {
                pathToPubkey: "2",
                pubkey_leaf: { pubkey: Alice.Pubkey }
            },
            siblings: AlicePDAsiblings
        };
    });

    // test if we are able to create append a leaf
    it("make a deposit of 2 accounts", async function() {
        await utils.registerToken(wallets[0]);

        await testTokenInstance.transfer(Alice.Address, 100);
        await depositManagerInstance.deposit(
            Alice.Amount,
            Alice.TokenType,
            Alice.Pubkey
        );
        await depositManagerInstance.depositFor(
            Bob.Address,
            Bob.Amount,
            Bob.TokenType,
            Bob.Pubkey
        );

        const subtreeDepth = 1;
        const _zero_account_mp = await stateStore.getSubTreeMerkleProof(
            "001",
            subtreeDepth
        );

        await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
            subtreeDepth,
            _zero_account_mp,
            { value: StakingAmountString }
        );
        const AliceAccount: Account = {
            ID: Alice.AccID,
            tokenType: Alice.TokenType,
            balance: Alice.Amount,
            nonce: Alice.nonce,
            burn: 0,
            lastBurn: 0
        };
        const BobAccount: Account = {
            ID: Bob.AccID,
            tokenType: Bob.TokenType,
            balance: Bob.Amount,
            nonce: Bob.nonce,
            burn: 0,
            lastBurn: 0
        };

        // Insert after finaliseDepositsAndSubmitBatch
        await stateStore.insert(AliceAccount);
        await stateStore.insert(BobAccount);
    });

    it("submit new batch 1st", async function() {
        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 1,
            nonce: 1
        };

        tx.signature = await utils.signTx(tx, wallets[0]);
        const txByte = await utils.TxToBytes(tx);

        const accountProofs = await utils.processTransferTxOffchain(
            stateStore,
            tx
        );

        // process transaction validity with process tx
        const result = await utils.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        await utils.compressAndSubmitBatch(tx, result.newStateRoot);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );
        const batchId = await utils.getBatchId();

        falseBatchZero = {
            batchId,
            txs: compressedTxs,
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };
    });

    it("dispute batch correct 1th batch(no error)", async function() {
        await utils.disputeBatch(falseBatchZero);

        const batchId = await utils.getBatchId();
        const batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId,
            falseBatchZero.batchId,
            "dispute shouldnt happen"
        );
    });

    it("submit new batch 2nd(False Batch)", async function() {
        var AliceAccountLeaf = await utils.createLeaf(Alice);
        var BobAccountLeaf = await utils.createLeaf(Bob);

        // prepare data for process Tx
        var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        var accountRoot = await IMTInstance.getTreeRoot();

        var isValid = await MTutilsInstance.verifyLeaf(
            accountRoot,
            utils.PubKeyHash(Alice.Pubkey),
            "2",
            AlicePDAsiblings
        );
        assert.equal(isValid, true, "pda proof wrong");

        var tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        };
        tx.signature = await utils.signTx(tx, wallets[0]);

        // alice balance tree merkle proof
        var AliceAccountSiblings: Array<string> = [
            BobAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = AliceAccountLeaf;
        var AliceAccountPath: string = "2";
        var isValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            AliceAccountPath,
            AliceAccountSiblings
        );
        expect(isValid).to.be.deep.eq(true);
        var AliceAccountMP = {
            accountIP: {
                pathToAccount: AliceAccountPath,
                account: {
                    ID: Alice.AccID,
                    tokenType: Alice.TokenType,
                    balance: Alice.Amount,
                    nonce: Alice.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: AliceAccountSiblings
        };

        Alice.Amount -= Number(tx.amount);
        Alice.nonce++;

        var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

        // bob balance tree merkle proof
        var BobAccountSiblings: Array<string> = [
            UpdatedAliceAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = BobAccountLeaf;
        var BobAccountPath: string = "3";

        var BobAccountMP = {
            accountIP: {
                pathToAccount: BobAccountPath,
                account: {
                    ID: Bob.AccID,
                    tokenType: Bob.TokenType,
                    balance: Bob.Amount,
                    nonce: Bob.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: BobAccountSiblings
        };

        Bob.Amount += Number(tx.amount);
        var accountProofs = {
            from: AliceAccountMP,
            to: BobAccountMP
        };
        const txByte = await utils.TxToBytes(tx);
        // process transaction validity with process tx
        const result = await RollupRedditInstance.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        var falseResult = await utils.falseProcessTx(tx, accountProofs);
        assert.equal(
            result[3],
            ErrorCode.InvalidTokenAmount,
            "False error ID. It should be `1`"
        );
        await utils.compressAndSubmitBatch(tx, falseResult);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );

        falseBatchOne = {
            batchId: 0,
            txs: compressedTxs,
            signatures: [tx.signature],
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        falseBatchOne.batchId = Number(batchId) - 1;
        // console.log(falseBatchOne)
    });
    it("dispute batch false 2nd batch", async function() {
        await rollupCoreInstance.disputeBatch(
            falseBatchOne.batchId,
            falseBatchOne.txs,
            falseBatchOne.batchProofs
        );

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        let batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "invalidBatchMarker is not zero");
        assert.equal(
            batchId - 1,
            falseBatchOne.batchId - 1,
            "batchId doesnt match"
        );
        const txs = await RollupUtilsInstance.DecompressTransfers(
            falseBatchOne.txs
        );
        Alice.Amount += Number(txs[0].amount);
        Bob.Amount -= Number(txs[0].amount);
        Alice.nonce--;
    });

    it("submit new batch 3rd", async function() {
        var AliceAccountLeaf = await utils.createLeaf(Alice);
        var BobAccountLeaf = await utils.createLeaf(Bob);

        // make a transfer between alice and bob's account
        var tranferAmount = 1;
        // prepare data for process Tx
        var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        var accountRoot = await IMTInstance.getTreeRoot();

        var isValid = await MTutilsInstance.verifyLeaf(
            accountRoot,
            utils.PubKeyHash(Alice.Pubkey),
            "2",
            AlicePDAsiblings
        );
        assert.equal(isValid, true, "pda proof wrong");

        var tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 0, // Error
            nonce: 2
        };
        tx.signature = await utils.signTx(tx, wallets[0]);

        // alice balance tree merkle proof
        var AliceAccountSiblings: Array<string> = [
            BobAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = AliceAccountLeaf;
        var AliceAccountPath: string = "2";
        var isValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            AliceAccountPath,
            AliceAccountSiblings
        );
        expect(isValid).to.be.deep.eq(true);
        var AliceAccountMP = {
            accountIP: {
                pathToAccount: AliceAccountPath,
                account: {
                    ID: Alice.AccID,
                    tokenType: Alice.TokenType,
                    balance: Alice.Amount,
                    nonce: Alice.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: AliceAccountSiblings
        };

        Alice.Amount -= Number(tx.amount);
        Alice.nonce++;

        var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

        // bob balance tree merkle proof
        var BobAccountSiblings: Array<string> = [
            UpdatedAliceAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = BobAccountLeaf;
        var BobAccountPath: string = "3";
        var isBobValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            BobAccountPath,
            BobAccountSiblings
        );

        var BobAccountMP = {
            accountIP: {
                pathToAccount: BobAccountPath,
                account: {
                    ID: Bob.AccID,
                    tokenType: Bob.TokenType,
                    balance: Bob.Amount,
                    nonce: Bob.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: BobAccountSiblings
        };

        Bob.Amount += Number(tx.amount);
        var accountProofs = {
            from: AliceAccountMP,
            to: BobAccountMP
        };

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await RollupRedditInstance.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        var falseResult = await utils.falseProcessTx(tx, accountProofs);
        assert.equal(
            result[3],
            ErrorCode.InvalidTokenAmount,
            "false Error Id. It should be `2`."
        );

        await utils.compressAndSubmitBatch(tx, falseResult);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );

        falseBatchTwo = {
            batchId: 0,
            txs: compressedTxs,
            signatures: [tx.signature],
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        falseBatchTwo.batchId = Number(batchId) - 1;
    });

    it("dispute batch false 3rd batch(Tx amount 0)", async function() {
        await rollupCoreInstance.disputeBatch(
            falseBatchTwo.batchId,
            falseBatchTwo.txs,
            falseBatchTwo.batchProofs
        );

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        let batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId - 1,
            falseBatchTwo.batchId - 1,
            "batchId doesnt match"
        );
        const txs = await RollupUtilsInstance.DecompressTransfers(
            falseBatchTwo.txs
        );
        Alice.Amount += Number(txs[0].amount);
        Bob.Amount -= Number(txs[0].amount);
        Alice.nonce--;
    });

    it("Registring new token", async function() {
        await TestToken.new().then(async (instance: any) => {
            let testToken2Instance = instance;
            console.log(
                "testToken2Instance.address: ",
                testToken2Instance.address
            );
            await tokenRegistryInstance.requestTokenRegistration(
                testToken2Instance.address,
                {
                    from: wallets[0].getAddressString()
                }
            );
            await tokenRegistryInstance.finaliseTokenRegistration(
                testToken2Instance.address,
                {
                    from: wallets[0].getAddressString()
                }
            );
        });
        var tokenAddress = await tokenRegistryInstance.registeredTokens(2);
        // TODO
    });

    it("submit new batch 5nd", async function() {
        var AliceAccountLeaf = await utils.createLeaf(Alice);
        var BobAccountLeaf = await utils.createLeaf(Bob);

        // prepare data for process Tx
        var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        var accountRoot = await IMTInstance.getTreeRoot();

        var isValid = await MTutilsInstance.verifyLeaf(
            accountRoot,
            utils.PubKeyHash(Alice.Pubkey),
            "2",
            AlicePDAsiblings
        );
        assert.equal(isValid, true, "pda proof wrong");

        var tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        };

        tx.signature = await utils.signTx(tx, wallets[0]);

        // alice balance tree merkle proof
        var AliceAccountSiblings: Array<string> = [
            BobAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = AliceAccountLeaf;
        var AliceAccountPath: string = "2";
        var isValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            AliceAccountPath,
            AliceAccountSiblings
        );
        expect(isValid).to.be.deep.eq(true);
        var AliceAccountMP = {
            accountIP: {
                pathToAccount: AliceAccountPath,
                account: {
                    ID: Alice.AccID,
                    tokenType: Alice.TokenType,
                    balance: Alice.Amount,
                    nonce: Alice.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: AliceAccountSiblings
        };

        Alice.Amount -= Number(tx.amount);
        Alice.nonce++;

        var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

        // bob balance tree merkle proof
        var BobAccountSiblings: Array<string> = [
            UpdatedAliceAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = BobAccountLeaf;
        var BobAccountPath: string = "3";
        var isBobValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            BobAccountPath,
            BobAccountSiblings
        );

        var BobAccountMP = {
            accountIP: {
                pathToAccount: BobAccountPath,
                account: {
                    ID: Bob.AccID,
                    tokenType: Bob.TokenType,
                    balance: Bob.Amount,
                    nonce: Bob.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: BobAccountSiblings
        };

        Bob.Amount += Number(tx.amount);
        var accountProofs = {
            from: AliceAccountMP,
            to: BobAccountMP
        };

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await RollupRedditInstance.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        var falseResult = await utils.falseProcessTx(tx, accountProofs);
        assert.equal(result[3], ErrorCode.InvalidTokenAmount, "False ErrorId.");
        await utils.compressAndSubmitBatch(tx, falseResult);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );

        falseBatchFive = {
            batchId: 0,
            txs: compressedTxs,
            signatures: [tx.signature],
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        falseBatchFive.batchId = Number(batchId) - 1;
    });
    it("dispute batch false 5th batch", async function() {
        await rollupCoreInstance.disputeBatch(
            falseBatchFive.batchId,
            falseBatchFive.txs,
            falseBatchFive.batchProofs
        );

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        let batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId - 1,
            falseBatchFive.batchId - 1,
            "batchId doesnt match"
        );
        const txs = await RollupUtilsInstance.DecompressTransfers(
            falseBatchFive.txs
        );
        Alice.Amount += Number(txs[0].amount);
        Bob.Amount -= Number(txs[0].amount);
        Alice.nonce--;
    });

    it("submit new batch 6nd(False Batch)", async function() {
        var AliceAccountLeaf = await utils.createLeaf(Alice);
        var BobAccountLeaf = await utils.createLeaf(Bob);
        // prepare data for process Tx
        var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        var accountRoot = await IMTInstance.getTreeRoot();

        var isValid = await MTutilsInstance.verifyLeaf(
            accountRoot,
            utils.PubKeyHash(Alice.Pubkey),
            "2",
            AlicePDAsiblings
        );
        assert.equal(isValid, true, "pda proof wrong");

        var bobPDAProof = {
            _pda: {
                pathToPubkey: "2",
                pubkey_leaf: { pubkey: Bob.Pubkey }
            },
            siblings: BobPDAsiblings
        };

        var tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: 1,
            amount: 0, // InvalidTokenAmount
            nonce: 2
        };
        tx.signature = await utils.signTx(tx, wallets[0]);
        // alice balance tree merkle proof
        var AliceAccountSiblings: Array<string> = [
            BobAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = AliceAccountLeaf;
        var AliceAccountPath: string = "2";
        var isValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            AliceAccountPath,
            AliceAccountSiblings
        );
        expect(isValid).to.be.deep.eq(true);
        var AliceAccountMP = {
            accountIP: {
                pathToAccount: AliceAccountPath,
                account: {
                    ID: Alice.AccID,
                    tokenType: Alice.TokenType,
                    balance: Alice.Amount,
                    nonce: Alice.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: AliceAccountSiblings
        };

        Alice.Amount -= Number(tx.amount);
        Alice.nonce++;

        var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

        // bob balance tree merkle proof
        var BobAccountSiblings: Array<string> = [
            UpdatedAliceAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = BobAccountLeaf;
        var BobAccountPath: string = "3";
        var isBobValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            BobAccountPath,
            BobAccountSiblings
        );

        var BobAccountMP = {
            accountIP: {
                pathToAccount: BobAccountPath,
                account: {
                    ID: Bob.AccID,
                    tokenType: Bob.TokenType,
                    balance: Bob.Amount,
                    nonce: Bob.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: BobAccountSiblings
        };

        Bob.Amount += Number(tx.amount);
        var accountProofs = {
            from: AliceAccountMP,
            to: BobAccountMP
        };

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await RollupRedditInstance.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        var falseResult = await utils.falseProcessTx(tx, accountProofs);
        assert.equal(result[3], ErrorCode.InvalidTokenAmount, "Wrong ErrorId");
        await utils.compressAndSubmitBatch(tx, falseResult);
        const compressedTxs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txByte],
            [tx.signature]
        );

        falseBatchComb = {
            batchId: 0,
            txs: compressedTxs,
            signatures: [tx.signature],
            batchProofs: {
                accountProofs: [accountProofs],
                pdaProof: [alicePDAProof]
            }
        };

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        falseBatchComb.batchId = Number(batchId) - 1;
    });

    it("submit new batch 7th(false batch)", async function() {
        var AliceAccountLeaf = await utils.createLeaf(Alice);
        var BobAccountLeaf = await utils.createLeaf(Bob);

        // make a transfer between alice and bob's account
        var tranferAmount = 1;
        // prepare data for process Tx
        var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        var accountRoot = await IMTInstance.getTreeRoot();

        var isValid = await MTutilsInstance.verifyLeaf(
            accountRoot,
            utils.PubKeyHash(Alice.Pubkey),
            "2",
            AlicePDAsiblings
        );
        assert.equal(isValid, true, "pda proof wrong");

        var tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: Alice.AccID,
            toIndex: Bob.AccID,
            tokenType: Alice.TokenType,
            amount: 0, // An invalid amount
            nonce: Alice.nonce + 1
        };
        tx.signature = await utils.signTx(tx, wallets[0]);

        // alice balance tree merkle proof
        var AliceAccountSiblings: Array<string> = [
            BobAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = AliceAccountLeaf;
        var AliceAccountPath: string = "2";
        var isValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            AliceAccountPath,
            AliceAccountSiblings
        );
        expect(isValid).to.be.deep.eq(true);
        var AliceAccountMP = {
            accountIP: {
                pathToAccount: AliceAccountPath,
                account: {
                    ID: Alice.AccID,
                    tokenType: Alice.TokenType,
                    balance: Alice.Amount,
                    nonce: Alice.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: AliceAccountSiblings
        };

        Alice.Amount -= Number(tx.amount);
        Alice.nonce++;

        var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

        // bob balance tree merkle proof
        var BobAccountSiblings: Array<string> = [
            UpdatedAliceAccountLeaf,
            utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
            zeroHashes[2],
            zeroHashes[3]
        ];
        var leaf = BobAccountLeaf;
        var BobAccountPath: string = "3";
        var isBobValid = await MTutilsInstance.verifyLeaf(
            currentRoot,
            leaf,
            BobAccountPath,
            BobAccountSiblings
        );

        var BobAccountMP = {
            accountIP: {
                pathToAccount: BobAccountPath,
                account: {
                    ID: Bob.AccID,
                    tokenType: Bob.TokenType,
                    balance: Bob.Amount,
                    nonce: Bob.nonce,
                    burn: 0,
                    lastBurn: 0
                }
            },
            siblings: BobAccountSiblings
        };

        Bob.Amount += Number(tx.amount);
        var accountProofs = {
            from: AliceAccountMP,
            to: BobAccountMP
        };

        const txByte = await utils.TxToBytes(tx);

        // process transaction validity with process tx
        const result = await RollupRedditInstance.processTransferTx(
            currentRoot,
            accountRoot,
            tx.signature,
            txByte,
            alicePDAProof,
            accountProofs
        );

        var falseResult = await utils.falseProcessTx(tx, accountProofs);
        assert.equal(
            result[3],
            ErrorCode.InvalidTokenAmount,
            "false ErrorId. it should be `2`"
        );
        await utils.compressAndSubmitBatch(tx, falseResult);
    });

    it("dispute batch false Combo batch", async function() {
        await rollupCoreInstance.disputeBatch(
            falseBatchComb.batchId,
            falseBatchComb.txs,
            falseBatchComb.batchProofs
        );

        let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
        let batchMarker = await rollupCoreInstance.invalidBatchMarker();
        assert.equal(batchMarker, "0", "batchMarker is not zero");
        assert.equal(
            batchId - 1,
            falseBatchComb.batchId - 1,
            "batchId doesnt match"
        );
    });
});
