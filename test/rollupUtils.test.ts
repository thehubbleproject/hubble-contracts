import { RollupUtilsFactory } from "../types/ethers-contracts/RollupUtilsFactory";
import { ClientUtilsFactory } from "../types/ethers-contracts/ClientUtilsFactory";
import { assert } from "chai";
import { TxTransfer } from "../ts/tx";
import { EMPTY_ACCOUNT } from "../ts/stateAccount";
import { ClientUtils } from "../types/ethers-contracts/ClientUtils";
import { ethers } from "@nomiclabs/buidler";

describe("RollupUtils", async function() {
    let ClientUtilsInstance: ClientUtils;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        ClientUtilsInstance = await new ClientUtilsFactory(signer).deploy();
    });

    it("test account encoding and decoding", async function() {
        const account = {
            ID: 1,
            tokenType: 2,
            balance: 3,
            nonce: 4,
            burn: 5,
            lastBurn: 6
        };

        const accountBytes = await ClientUtilsInstance.BytesFromAccount(
            account
        );

        const regeneratedAccount = await ClientUtilsInstance.AccountFromBytes(
            accountBytes
        );
        assert.equal(regeneratedAccount["0"].toNumber(), account.ID);
        assert.equal(regeneratedAccount["1"].toNumber(), account.balance);
        assert.equal(regeneratedAccount["2"].toNumber(), account.nonce);
        assert.equal(regeneratedAccount["3"].toNumber(), account.tokenType);
        assert.equal(regeneratedAccount["4"].toNumber(), account.burn);
        assert.equal(regeneratedAccount["5"].toNumber(), account.lastBurn);

        const tx = TxTransfer.rand().extended();

        const txBytes = await ClientUtilsInstance.TransferToBytes(tx);
        // console.log("tx bytes: " + txBytes);

        const txData = await ClientUtilsInstance.FromBytesToTransfer(txBytes);
        assert.equal(txData.fromIndex.toString(), tx.fromIndex.toString());
        assert.equal(txData.toIndex.toString(), tx.toIndex.toString());
        assert.equal(txData.tokenType.toString(), tx.tokenType.toString());
        assert.equal(txData.nonce.toString(), tx.nonce.toString());
        assert.equal(txData.txType.toString(), tx.txType.toString());
        assert.equal(txData.amount.toString(), tx.amount.toString());
    });
    it("test transfer utils", async function() {
        const tx = TxTransfer.rand().extended();
        const signBytes = await ClientUtilsInstance.getTransferSignBytes(tx);
        const txBytes = await ClientUtilsInstance.TransferToBytes(tx);
        await ClientUtilsInstance.CompressTransferFromEncoded(txBytes, "0x00");
        const txs = await ClientUtilsInstance.CompressManyTransferFromEncoded(
            [txBytes, txBytes],
            ["0x00", "0x00"]
        );
        await ClientUtilsInstance.DecompressManyTransfer(txs);
    });
});
