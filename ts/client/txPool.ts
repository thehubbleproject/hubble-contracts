import { BigNumber } from "ethers";
import {
    PoolEmptyError,
    PoolFullError,
    TokenNotConfiguredError,
    TokenPoolEmpty,
    TokenPoolHighestFeeError
} from "../exceptions";
import { sum } from "../utils";
import { FeeReceivers } from "./config";
import { OffchainTx } from "./features/interface";
import { StateStorageEngine } from "./storageEngine";

const sortByFee = (a: OffchainTx, b: OffchainTx): number => {
    if (a.fee.lt(b.fee)) {
        return -1;
    }
    if (a.fee.gt(b.fee)) {
        return 1;
    }
    return 0;
};

/**
 * Pool of pending transactions with functionality to retrieve the
 * most proftable transactions to process.
 */
export class MultiTokenPool<Item extends OffchainTx> {
    private tokenIDStrToQueue: Record<string, Item[]>;
    private tokenIDStrToFeeRecieverID: Record<string, BigNumber>;
    private txCount: number;

    /**
     * @param stateStorage State tree storage
     * @param feeRecievers List of tokenIDs to feeRecieverIDs
     * @param maxSize Optional mamximum number of transactions allowed in pool. Default 1024.
     */
    constructor(
        private readonly stateStorage: StateStorageEngine,
        feeRecievers: FeeReceivers,
        public readonly maxSize: number = 1024
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

    /**
     * Gets the current number of transactions in the pool.
     *
     * @param tokenID Optional filter number of transactions by a tokenID
     * @returns Number of transactions in pool
     */
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

    /**
     * Adds a transaction to the pool.
     *
     * @param tx Transaction to add to pool.
     */
    public async push(tx: Item): Promise<void> {
        if (this.txCount >= this.maxSize) {
            throw new PoolFullError(this.maxSize);
        }

        const fromState = await this.stateStorage.get(tx.fromIndex.toNumber());
        const tokenIDStr = fromState.tokenID.toString();
        const tokenQueue = this.tokenIDStrToQueue[tokenIDStr];
        if (!tokenQueue) {
            throw new TokenNotConfiguredError(tokenIDStr);
        }

        tokenQueue.push(tx);
        this.txCount++;
    }

    /**
     * Removes the highest fee transaction for a token from the pool.
     *
     * @param tokenID Token to remove a transaction for.
     * @returns Transaction from the pool
     */
    public pop(tokenID: BigNumber): Item {
        const tokenIDStr = tokenID.toString();
        const tokenQueue = this.tokenIDStrToQueue[tokenIDStr];
        if (!tokenQueue) {
            throw new TokenNotConfiguredError(tokenIDStr);
        }
        tokenQueue.sort(sortByFee);

        const tx = tokenQueue.pop();
        if (!tx) {
            throw new TokenPoolEmpty(tokenID.toString());
        }
        this.txCount--;
        return tx;
    }

    /**
     * Gets the highest value token transactions to process.
     *
     * Currently doesn't account for the token's exchange rate and
     * prioritizes by summed fees.
     *
     * https://github.com/thehubbleproject/hubble-contracts/issues/572
     * will change this behavior.
     *
     * @returns Object with the highest value tokenID, its feeReceiverID,
     * and the sum of its total fees.
     */
    public async getHighestValueToken(): Promise<{
        tokenID: BigNumber;
        feeReceiverID: BigNumber;
        sumFees: BigNumber;
    }> {
        if (!this.txCount) {
            throw new PoolEmptyError();
        }

        let highValue = BigNumber.from(-1);
        let tokenID = BigNumber.from(-1);
        for (const tokenIDStr of Object.keys(this.tokenIDStrToQueue)) {
            const value = this.getQueueValue(tokenIDStr);
            if (value.gt(highValue)) {
                highValue = value;
                tokenID = BigNumber.from(tokenIDStr);
            }
        }

        // This case should never be hit, but best to be explicit if it does
        if (highValue.lt(0) || tokenID.lt(0)) {
            throw new TokenPoolHighestFeeError();
        }

        const feeReceiverID = this.tokenIDStrToFeeRecieverID[
            tokenID.toString()
        ];
        return {
            tokenID,
            feeReceiverID,
            sumFees: highValue
        };
    }

    private getQueueValue(tokenIDStr: string): BigNumber {
        const tokenQueue = this.tokenIDStrToQueue[tokenIDStr];
        if (!tokenQueue.length) {
            return BigNumber.from(-1);
        }

        return sum(tokenQueue.map(tx => tx.fee));
    }
}
