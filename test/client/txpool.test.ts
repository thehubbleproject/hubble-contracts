import { assert } from "chai";
import { TransferPool } from "../../ts/client/txPool";
import { CommonToken } from "../../ts/decimal";
import { TxTransfer } from "../../ts/tx";

describe("Tx pool", function() {
    it("transfer Tx pool", async function() {
        const tx1 = TxTransfer.rand({
            fee: CommonToken.fromHumanValue("10").l2Value
        });
        const tx2 = TxTransfer.rand({
            fee: CommonToken.fromHumanValue("20").l2Value
        });
        const tx3 = TxTransfer.rand({
            fee: CommonToken.fromHumanValue("30").l2Value
        });
        const pool = new TransferPool(3);
        pool.add(tx1);
        assert.deepEqual(pool.pick(1), [tx1]);
        assert.deepEqual(pool.pick(1), []);
        pool.add(tx1);
        pool.add(tx2);
        assert.deepEqual(pool.pick(1), [tx2]);
        pool.add(tx3);
        assert.deepEqual(pool.pick(2), [tx3, tx1]);
        pool.add(tx1);
        pool.add(tx2);
        pool.add(tx3);
        pool.add(tx1);
        assert.deepEqual(pool.pick(3), [tx3, tx2, tx1]);
        pool.add(tx1);
        pool.add(tx2);
        pool.add(tx3);
        pool.add(tx3);
        assert.deepEqual(pool.pick(3), [tx3, tx3, tx2]);
    });
});
