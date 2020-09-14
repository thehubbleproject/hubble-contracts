import { assert } from "chai";
import { TxTransfer } from "../ts/tx";
import { EMPTY_ACCOUNT } from "../ts/stateAccount";
import { RollupUtilsFactory } from "../types/ethers-contracts/RollupUtilsFactory";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { ethers } from "@nomiclabs/buidler";

describe("RollupUtils", async function() {
    let RollupUtilsInstance: RollupUtils;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        RollupUtilsInstance = await new RollupUtilsFactory(signer).deploy();
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
});
