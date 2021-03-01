import { Tx, TxTransfer } from "../tx";

// Don't care about token and their exchange rate, just compare the numeric value of fee
function naiveCompareFee(a: Tx, b: Tx) {
    if (a.fee.lt(b.fee)) {
        return -1;
    }
    if (a.fee.gt(b.fee)) {
        return 1;
    }
    return 0;
}

export class TxPool<Item extends Tx> {
    private queue: Item[];
    constructor(public maxSize: Number) {
        this.queue = [];
    }
    get size() {
        return this.queue.length;
    }
    add(tx: Item) {
        this.queue.push(tx);
        this.queue.sort(naiveCompareFee);
        if (this.queue.length > this.maxSize) {
            this.queue.shift();
        }
    }
    pick(n: number) {
        const len = Math.min(n, this.queue.length);
        const result = [];
        for (let i = 0; i < len; i++) {
            result.push(this.queue.pop());
        }
        return result;
    }
}

export class TransferPool extends TxPool<TxTransfer> {}
