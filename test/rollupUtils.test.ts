import { assert } from "chai";
import { TxTransfer } from "../ts/tx";
import { EMPTY_STATE } from "../ts/state";
import { RollupUtilsFactory } from "../types/ethers-contracts/RollupUtilsFactory";
import { RollupUtils } from "../types/ethers-contracts/RollupUtils";
import { ethers } from "@nomiclabs/buidler";
import { MassMigrationCommitment, TransferCommitment } from "../ts/commitments";
import * as mcl from "../ts/mcl";

describe("RollupUtils", async function() {
    let RollupUtilsInstance: RollupUtils;
    before(async function() {
        const [signer, ...rest] = await ethers.getSigners();
        RollupUtilsInstance = await new RollupUtilsFactory(signer).deploy();
    });

    it("test state encoding and decoding", async function() {
        const state = EMPTY_STATE;

        const encodedState = await RollupUtilsInstance.BytesFromState(state);
        const decoded = await RollupUtilsInstance.StateFromBytes(encodedState);
        assert.equal(decoded.pubkeyIndex.toNumber(), state.pubkeyIndex);
        assert.equal(decoded.balance.toNumber(), state.balance);
        assert.equal(decoded.nonce.toNumber(), state.nonce);
        assert.equal(decoded.tokenType.toNumber(), state.tokenType);
    });
    it("test transfer utils", async function() {
        const txRaw = TxTransfer.rand();
        const tx = txRaw.extended();
        tx.txType = 1;
        const signBytes = await RollupUtilsInstance[
            "getTxSignBytes((uint256,uint256,uint256,uint256,uint256,uint256))"
        ](tx);
        assert.equal(signBytes, txRaw.message());
        const txBytes = await RollupUtilsInstance[
            "BytesFromTx((uint256,uint256,uint256,uint256,uint256,uint256))"
        ](tx);
        const txData = await RollupUtilsInstance.TxFromBytes(txBytes);
        assert.equal(txData.fromIndex.toNumber(), tx.fromIndex);
        assert.equal(txData.toIndex.toNumber(), tx.toIndex);
        assert.equal(txData.nonce.toNumber(), tx.nonce);
        assert.equal(txData.txType.toNumber(), tx.txType);
        assert.equal(txData.amount.toString(), tx.amount.toString());
        await RollupUtilsInstance.CompressTransferFromEncoded(txBytes, "0x00");
        const txs = await RollupUtilsInstance.CompressManyTransferFromEncoded(
            [txBytes, txBytes],
            ["0x00", "0x00"]
        );
        await RollupUtilsInstance.DecompressManyTransfer(txs);
    });
    it("test transfer commitment", async function() {
        const commitment = TransferCommitment.new();
        const hash = await RollupUtilsInstance.TransferCommitmentToHash(
            commitment.toSolStruct()
        );
        assert.equal(hash, commitment.hash());
    });
    it("test mass migration commitment", async function() {
        const commitment = MassMigrationCommitment.new();
        const hash = await RollupUtilsInstance.MMCommitmentToHash(
            commitment.toSolStruct()
        );
        assert.equal(hash, commitment.hash());
    });

    it("bytes from Tx", async function() {
        await mcl.init();
        const keyPair = mcl.newKeyPair();
        // receive signed encoded tx from user
        const pubkey = mcl.g2ToHex(keyPair.pubkey);

        let encodedTx = await RollupUtilsInstance[
            "BytesFromTx(uint256,uint256[4],uint256[4],uint256,uint256,uint256,uint256)"
        ](1, pubkey, pubkey, 1, 1, 1, 1);

        // re-encode to Create2Transfer
        encodedTx = await RollupUtilsInstance.Create2PubkeyToIndex(
            encodedTx,
            3,
            4,
            1
        );

        const decodedTx = await RollupUtilsInstance[
            "Create2TransferFromBytes(bytes)"
        ](encodedTx);

        assert.equal(
            decodedTx.fromIndex.toString(),
            "3",
            "from index not correct"
        );
        assert.equal(decodedTx.toIndex.toString(), "4", "to index not correct");
        // TODO fix
        // assert.equal(decodedTx.amount.toString(), "1", "amount not correct");
    });
});
