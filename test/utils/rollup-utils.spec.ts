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
import { DummyECDSASignature } from "../../scripts/helpers/constants";
import { RollupUtilsFactory } from "../../types/ethers-contracts/RollupUtilsFactory";
import { RollupUtils } from "../../types/ethers-contracts/RollupUtils";
import { ethers } from "@nomiclabs/buidler";

describe("RollupUtils", async function() {
    let RollupUtilsInstance: RollupUtils;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        RollupUtilsInstance = await new RollupUtilsFactory(signer).deploy();
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
            fee: 1,
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
            tx.amount,
            tx.fee
        );

        const txData = await RollupUtilsInstance.TxFromBytes(txBytes);
        assert.equal(txData.fromIndex.toString(), tx.fromIndex.toString());
        assert.equal(txData.toIndex.toString(), tx.toIndex.toString());
        assert.equal(txData.tokenType.toString(), tx.tokenType.toString());
        assert.equal(txData.nonce.toString(), tx.nonce.toString());
        assert.equal(txData.txType.toString(), tx.txType.toString());
        assert.equal(txData.amount.toString(), tx.amount.toString());
    });
    it("test createAccount utils", async function() {
        const tx: CreateAccount = {
            txType: Usage.CreateAccount,
            accountID: 1,
            stateID: 1,
            tokenType: 1
        };
        const txBytes = await RollupUtilsInstance.BytesFromCreateAccountNoStruct(
            tx.txType,
            tx.accountID,
            tx.stateID,
            tx.tokenType
        );
        const result = await RollupUtilsInstance.CreateAccountFromBytes(
            txBytes
        );
        assert.equal(Number(result.accountID), tx.accountID);
        assert.equal(Number(result.stateID), tx.stateID);
        assert.equal(Number(result.tokenType), tx.tokenType);
        await RollupUtilsInstance.CompressCreateAccountFromEncoded(txBytes);
        const txs = await RollupUtilsInstance.CompressManyCreateAccountFromEncoded(
            [txBytes, txBytes]
        );
        await RollupUtilsInstance.DecompressManyCreateAccount(txs);
    });
    it("test airdrop utils", async function() {
        const tx: DropTx = {
            txType: Usage.Airdrop,
            fromIndex: 1,
            toIndex: 1,
            tokenType: 1,
            nonce: 2,
            amount: 10,
            signature: DummyECDSASignature
        };
        const signBytes = await RollupUtilsInstance.AirdropSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
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
        assert.equal(Number(result.toIndex), tx.toIndex);
        await RollupUtilsInstance.CompressAirdropFromEncoded(
            txBytes,
            tx.signature
        );
        const txs = await RollupUtilsInstance.CompressManyAirdropFromEncoded([
            txBytes,
            txBytes
        ]);
        await RollupUtilsInstance.DecompressManyAirdrop(txs);
    });
    it("test transfer utils", async function() {
        const tx: Transaction = {
            txType: Usage.Transfer,
            fromIndex: 1,
            toIndex: 2,
            tokenType: 1,
            nonce: 3,
            amount: 1,
            fee: 1,
            signature: DummyECDSASignature
        };
        const signBytes = await RollupUtilsInstance.getTxSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.nonce,
            tx.amount,
            tx.fee
        );
        const txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
            tx.txType,
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.amount,
            tx.fee
        );
        await RollupUtilsInstance.CompressTransferFromEncoded(
            txBytes,
            tx.signature
        );
        const txs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txBytes, txBytes],
            [tx.signature, tx.signature]
        );
        await RollupUtilsInstance.DecompressManyTransfer(txs);
    });
    it("test burn consent utils", async function() {
        const tx: BurnConsentTx = {
            txType: Usage.BurnConsent,
            fromIndex: 1,
            amount: 5,
            nonce: 3,
            signature: DummyECDSASignature
        };
        const signBytes = await RollupUtilsInstance.BurnConsentSignBytes(
            tx.txType,
            tx.fromIndex,
            tx.nonce,
            tx.amount
        );
        const txBytes = await RollupUtilsInstance.BytesFromBurnConsentNoStruct(
            tx.txType,
            tx.fromIndex,
            tx.amount,
            tx.nonce
        );
        await RollupUtilsInstance.BurnConsentFromBytes(txBytes);
        await RollupUtilsInstance.CompressBurnConsentFromEncoded(txBytes);
        const txs = await RollupUtilsInstance.CompressManyBurnConsentFromEncoded(
            [txBytes, txBytes]
        );
        await RollupUtilsInstance.DecompressManyBurnConsent(txs);
    });
    it("test burn execution utils", async function() {
        const tx: BurnExecutionTx = {
            txType: Usage.BurnExecution,
            fromIndex: 5
        };
        const txBytes = await RollupUtilsInstance.BytesFromBurnExecutionNoStruct(
            tx.txType,
            tx.fromIndex
        );
        await RollupUtilsInstance.BurnExecutionFromBytes(txBytes);
        await RollupUtilsInstance.CompressBurnExecutionFromEncoded(txBytes);
        const txs = await RollupUtilsInstance.CompressManyBurnExecutionFromEncoded(
            [txBytes, txBytes]
        );
        await RollupUtilsInstance.DecompressManyBurnExecution(txs);
    });
});
