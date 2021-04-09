import { sum } from "../utils";
import { OffchainTx } from "./features/interface";

// Don't care about token and their exchange rate, just compare the numeric value of fee
function naiveCompareFee(a: OffchainTx, b: OffchainTx) {
    if (a.fee.lt(b.fee)) {
        return -1;
    }
    if (a.fee.gt(b.fee)) {
        return 1;
    }
    return 0;
}

export class SameTokenPool<Item extends OffchainTx> {
    private queue: Item[];
    constructor(public maxSize: Number) {
        this.queue = [];
    }
    get size() {
        return this.queue.length;
    }
    push(tx: Item) {
        this.queue.push(tx);
        this.queue.sort(naiveCompareFee);
        if (this.queue.length > this.maxSize) {
            this.queue.shift();
        }
    }
    pop() {
        const tx = this.queue.pop();
        if (!tx) throw new Error("Pool empty");
        return tx;
    }
    getValue(topN?: number) {
        const size = topN ?? this.queue.length;
        return sum(this.queue.slice(-size).map(tx => tx.fee));
    }
}
