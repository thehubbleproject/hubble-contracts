import { assert } from "chai";
import { TxTransfer, TxCreate, TxBurnConsent, TxBurnExecution } from "../ts/tx";
import { EMPTY_ACCOUNT } from "../ts/state_account";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { ethers } from "@nomiclabs/buidler";

describe("RollupUtils", async function() {
    let RollupUtilsInstance: RollupUtils;
    before(async function() {
        const factory = await ethers.getContractFactory("RollupUtils");
        RollupUtilsInstance = (await factory.deploy()) as RollupUtils;
    });

    it("test account encoding and decoding", async function() {
        const account = EMPTY_ACCOUNT;

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

        const tx = TxTransfer.rand().extended();

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
        const tx = TxCreate.rand().extended();
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
        const tx = TxTransfer.rand().extended();
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
        await RollupUtilsInstance.CompressAirdropFromEncoded(txBytes, "0x00");
        const txs = await RollupUtilsInstance.CompressManyAirdropFromEncoded([
            txBytes,
            txBytes
        ]);
        await RollupUtilsInstance.DecompressManyAirdrop(txs);
    });
    it("test transfer utils", async function() {
        const tx = TxTransfer.rand().extended();
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
        await RollupUtilsInstance.CompressTransferFromEncoded(txBytes, "0x00");
        const txs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txBytes, txBytes],
            ["0x00", "0x00"]
        );
        await RollupUtilsInstance.DecompressManyTransfer(txs);
    });
    it("test burn consent utils", async function() {
        const tx = TxBurnConsent.rand().extended();
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
        const tx = TxBurnExecution.rand().extended();
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
