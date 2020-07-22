import * as walletHelper from "../..//scripts/helpers/wallet";
import { assert } from "chai";

const RollupUtils = artifacts.require("RollupUtils");

contract("RollupUtils", async function(accounts) {
    var wallets: any;
    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
    });

    it("test account encoding and decoding", async function() {
        var rollupUtils = await RollupUtils.deployed();
        var account = {
            ID: 1,
            tokenType: 2,
            balance: 3,
            nonce: 4,
            burn: 0,
            lastBurn: 0
        };

        var accountBytes = await rollupUtils.BytesFromAccountDeconstructed(
            account.ID,
            account.balance,
            account.nonce,
            account.tokenType,
            account.burn,
            account.lastBurn
        );
        var regeneratedAccount = await rollupUtils.AccountFromBytes(
            accountBytes
        );
        assert.equal(regeneratedAccount["0"].toNumber(), account.ID);
        assert.equal(regeneratedAccount["1"].toNumber(), account.balance);
        assert.equal(regeneratedAccount["2"].toNumber(), account.nonce);
        assert.equal(regeneratedAccount["3"].toNumber(), account.tokenType);
        assert.equal(regeneratedAccount["4"].toNumber(), account.burn);
        assert.equal(regeneratedAccount["5"].toNumber(), account.lastBurn);

        var tx = {
            fromIndex: 1,
            toIndex: 2,
            tokenType: 1,
            amount: 10,
            signature:
                "0x1ad4773ace8ee65b8f1d94a3ca7adba51ee2ca0bdb550907715b3b65f1e3ad9f69e610383dc9ceb8a50c882da4b1b98b96500bdf308c1bdce2187cb23b7d736f1b",
            txType: 1,
            nonce: 0
        };

        var txBytes = await rollupUtils.BytesFromTxDeconstructed(
            tx.fromIndex,
            tx.toIndex,
            tx.tokenType,
            tx.nonce,
            tx.txType,
            tx.amount
        );

        var txData = await rollupUtils.TxFromBytes(txBytes);
        assert.equal(txData.fromIndex.toString(), tx.fromIndex.toString());
        assert.equal(txData.toIndex.toString(), tx.toIndex.toString());
        assert.equal(txData.tokenType.toString(), tx.tokenType.toString());
        assert.equal(txData.nonce.toString(), tx.nonce.toString());
        assert.equal(txData.txType.toString(), tx.txType.toString());
        assert.equal(txData.amount.toString(), tx.amount.toString());

        var compressedTx = await rollupUtils.CompressTxWithMessage(
            txBytes,
            tx.signature
        );

        var decompressedTx = await rollupUtils.DecompressTx(compressedTx);
        assert.equal(decompressedTx[0].toNumber(), tx.fromIndex);
        assert.equal(decompressedTx[1].toNumber(), tx.toIndex);
        assert.equal(decompressedTx[2].toNumber(), tx.amount);
        assert.equal(decompressedTx[3].toString(), tx.signature);
    });
});
