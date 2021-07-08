import { BigNumber } from "ethers";
import { sum } from "../utils";
import { FeeReceivers } from "./config";
import { OffchainTx } from "./features/interface";
import { StateStorageEngine } from "./storageEngine";

function naiveCompareFee(a: OffchainTx, b: OffchainTx) {
    if (a.fee.lt(b.fee)) {
        return -1;
    }
    if (a.fee.gt(b.fee)) {
        return 1;
    }
    return 0;
}

export class MultiTokenPool<Item extends OffchainTx> {
    private tokenIDStrToQueue: Record<string, Item[]>;
    private tokenIDStrToFeeRecieverID: Record<string, BigNumber>;
    private txCount: number;

    constructor(
        private readonly stateStorage: StateStorageEngine,
        feeRecievers: FeeReceivers,
        public readonly maxSize: Number = 1024
    ) {
        this.tokenIDStrToQueue = {};
        this.tokenIDStrToFeeRecieverID = {};
        for (const { tokenID, stateID } of feeRecievers) {
            const tokenIDStr = BigNumber.from(tokenID).toString();
            const bnStateID = BigNumber.from(stateID);

            this.tokenIDStrToQueue[tokenIDStr] = [];
            this.tokenIDStrToFeeRecieverID[tokenIDStr] = bnStateID;
        }

        this.txCount = 0;
    }

    public size(tokenID?: BigNumber): number {
        if (!tokenID) {
            return this.txCount;
        }
        const queue = this.tokenIDStrToQueue[tokenID.toString()];
        if (!queue) {
            return 0;
        }
        return queue.length;
    }

    public async push(tx: Item): Promise<void> {
        if (this.txCount > this.maxSize) {
            throw new Error(`MultiTokenPool: max size ${this.maxSize} reached`);
        }

        const fromState = await this.stateStorage.get(tx.fromIndex.toNumber());
        // TODO State struct needs BN as well.
        const tokenQueue = this.tokenIDStrToQueue[fromState.tokenID.toString()];
        tokenQueue.push(tx);
    }
    // Don't care about token and their exchange rate, just compare the numeric value of fee
    // https://github.com/thehubbleproject/hubble-contracts/issues/572
    public async getHighestValueToken(): Promise<{
        tokenID: BigNumber;
        feeReceiverID: BigNumber;
    }> {
        let highValue = BigNumber.from(0);
        let tokenID = BigNumber.from(-1);
        for (const tokenIDStr of Object.keys(this.tokenIDStrToQueue)) {
            const value = this.getQueueValue(tokenIDStr);
            if (value.gt(highValue)) {
                highValue = value;
                tokenID = BigNumber.from(tokenIDStr);
            }
        }

        const feeReceiverID = this.tokenIDStrToFeeRecieverID[
            tokenID.toString()
        ];
        return {
            tokenID,
            feeReceiverID
        };
    }

    public pop(tokenID: BigNumber): Item {
        const tokenQueue = this.tokenIDStrToQueue[tokenID.toString()];
        tokenQueue.sort(naiveCompareFee);

        const tx = tokenQueue.pop();
        if (!tx) {
            throw new Error(
                `MultiTokenPool: tokenID ${tokenID.toString()} empty`
            );
        }
        return tx;
    }

    private getQueueValue(tokenIDStr: string): BigNumber {
        return sum(this.tokenIDStrToQueue[tokenIDStr].map(tx => tx.fee));
    }
}
