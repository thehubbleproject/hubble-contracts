import { assert } from "chai";
import {
    CreateAccount,
    Account,
    Transaction,
    DropTx,
    Usage,
    BurnConsentTx,
    BurnExecutionTx
} from "../../scripts/helpers/interfaces";

const RollupUtils = artifacts.require("RollupUtils");

contract("RollupUtils", async function(accounts) {
    let RollupUtilsInstance: any;
    before(async function() {
        RollupUtilsInstance = await RollupUtils.deployed();
    });

    it("test account encoding and decoding", async function() {
        const account: Account = {
            ID: 1,
            tokenType: 2,
            balance: 3,
            nonce: 4,
            burn: 0,
            lastBurn: 0
        };

        const accountBytes = await RollupUtilsInstance.BytesFromAccountDeconstructed(
            account.ID,
            account.balance,
            account.nonce,
            account.tokenType,
            account.burn,
            account.lastBurn
        );
        const regeneratedAccount = await RollupUtilsInstance.AccountFromBytes(
            accountBytes
        );
        assert.equal(regeneratedAccount["0"].toNumber(), account.ID);
        assert.equal(regeneratedAccount["1"].toNumber(), account.balance);
        assert.equal(regeneratedAccount["2"].toNumber(), account.nonce);
        assert.equal(regeneratedAccount["3"].toNumber(), account.tokenType);
        assert.equal(regeneratedAccount["4"].toNumber(), account.burn);
        assert.equal(regeneratedAccount["5"].toNumber(), account.lastBurn);

        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: 1,
            toIndex: 2,
            tokenType: 1,
            amount: 10,
            signature:
                "0x1ad4773ace8ee65b8f1d94a3ca7adba51ee2ca0bdb550907715b3b65f1e3ad9f69e610383dc9ceb8a50c882da4b1b98b96500bdf308c1bdce2187cb23b7d736f1b",
            nonce: 0
        };

        const txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );

        const txData = await RollupUtilsInstance.TxFromBytes(txBytes);
        assert.equal(txData.fromIndex.toString(), tx.fromIndex.toString());
        assert.equal(txData.toIndex.toString(), tx.toIndex.toString());
        assert.equal(txData.tokenType.toString(), tx.tokenType.toString());
        assert.equal(txData.nonce.toString(), tx.nonce.toString());
        assert.equal(txData.txType.toString(), tx.txType.toString());
        assert.equal(txData.amount.toString(), tx.amount.toString());

        const compressedTx = await RollupUtilsInstance.CompressTxWithMessage(
            txBytes,
            tx.signature
        );

        const decompressedTx = await RollupUtilsInstance.DecompressTx(
            compressedTx
        );
        assert.equal(decompressedTx[0].toNumber(), tx.fromIndex);
        assert.equal(decompressedTx[1].toNumber(), tx.toIndex);
        assert.equal(decompressedTx[2].toNumber(), tx.amount);
        assert.equal(decompressedTx[3].toString(), tx.signature);
    });
    it("test createAccount utils", async function() {
        const tx: CreateAccount = {
            txType: Usage.CreateAccount,
            toIndex: 1,
            tokenType: 1
        };
        const txBytes = await RollupUtilsInstance.BytesFromCreateAccountNoStruct(
            tx.txType,
            tx.toIndex,
            tx.tokenType
        );
        const result = await RollupUtilsInstance.CreateAccountFromBytes(
            txBytes
        );
        assert.equal(result.toIndex, tx.toIndex);
        assert.equal(result.tokenType, tx.tokenType);
        const compressedTx = await RollupUtilsInstance.CompressCreateAccountNoStruct(
            tx.toIndex,
            tx.tokenType
        );
        await RollupUtilsInstance.DecompressCreateAccount(compressedTx);
    });
    it("test airdrop utils", async function() {
        const tx: DropTx = {
            txType: Usage.Airdrop,
            fromIndex: 1,
            toIndex: 1,
            tokenType: 1,
            nonce: 2,
            amount: 10,
            signature: "0xabcd"
        };
        const signBytes = await RollupUtilsInstance.AirdropSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );
        const txBytes = await RollupUtilsInstance.BytesFromAirdropNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );
        const result = await RollupUtilsInstance.AirdropFromBytes(txBytes);
        assert.equal(result.toIndex, tx.toIndex);
        const compressedTx1 = await RollupUtilsInstance.CompressAirdropNoStruct(
            tx.toIndex,
            tx.amount,
            tx.signature
        );
        const compressedTx2 = await RollupUtilsInstance.CompressAirdropTxWithMessage(
            txBytes,
            tx.signature
        );
        assert.equal(compressedTx1, compressedTx2);
        await RollupUtilsInstance.DecompressCreateAccount(compressedTx1);
        await RollupUtilsInstance.DecompressCreateAccount(compressedTx2);
    });
    it("test transfer utils", async function() {
        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: 1,
            toIndex: 2,
            tokenType: 1,
            nonce: 3,
            amount: 1,
            signature: "0xabcd"
        };
        const signBytes = await RollupUtilsInstance.getTxSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );
        const txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount
        );
        const compressedTx = await RollupUtilsInstance.CompressTxWithMessage(
            txBytes,
            tx.signature
        );
        await RollupUtilsInstance.DecompressTx(compressedTx);
    });
    it("test burn consent utils", async function() {
        const tx: BurnConsentTx = {
            txType: Usage.BurnConsent,
            fromIndex: 1,
            amount: 5,
            nonce: 3,
            signature: "0xabcd"
        };
        const signBytes = await RollupUtilsInstance.BurnConsentSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.amount,
            tx.nonce
        );
        const txBytes = await RollupUtilsInstance.BytesFromBurnConsentNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.amount,
            tx.nonce
        );
        await RollupUtilsInstance.BurnConsentFromBytes(txBytes);
        const compressedTx = await RollupUtilsInstance.CompressBurnConsentNoStruct(
            tx.fromIndex,
            tx.amount,
            tx.nonce,
            tx.signature
        );
        await RollupUtilsInstance.DecompressBurnConsent(compressedTx);
    });
    it("test burn execution utils", async function() {
        const tx = {
            txType: Usage.BurnExecution,
            fromIndex: 5
        } as BurnExecutionTx;
        const signBytes = await RollupUtilsInstance.BurnExecutionSignBytes(
            tx.txType,
            tx.fromIndex
        );
        const txBytes = await RollupUtilsInstance.BytesFromBurnExecutionNoStruct(
            tx.txType,
            tx.fromIndex
        );
        await RollupUtilsInstance.BurnExecutionFromBytes(txBytes);
        const compressedTx = await RollupUtilsInstance.CompressBurnExecutionNoStruct(
            tx.fromIndex
        );
        await RollupUtilsInstance.DecompressBurnExecution(compressedTx);
    });
});
