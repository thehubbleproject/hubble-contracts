import { TxTransfer } from "../tx";

// Don't care about token and their exchange rate, just compare the numeric value of fee
function naiveCompareFee(a: TxTransfer, b: TxTransfer) {
    if (a.fee.lt(b.fee)) {
        return -1;
    }
    if (a.fee.gt(b.fee)) {
        return 1;
    }
    return 0;
}

export class TxPool {
    private heap: TxTransfer[];
    constructor() {
        this.heap = [];
    }
    get size() {
        return this.heap.length;
    }
    add(tx: TxTransfer) {
        this.heap.push(tx);
    }
    pick(n: number) {
        this.heap.sort(naiveCompareFee);
        const result = [];
        for (let i = 0; i < n; i++) {
            result.push(this.heap.pop());
        }
        return result;
    }
}
