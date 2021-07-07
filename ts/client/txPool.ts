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
    private tokenIDHexStrToQueue: Record<string, Item[]>;
    private tokenIDHexStrToFeeRecieverID: Record<string, BigNumber>;
    private txCount: number;

    constructor(private readonly stateStorage: StateStorageEngine, feeRecievers: FeeReceivers, public readonly maxSize: Number = 1024) {
        this.tokenIDHexStrToQueue = {};
        this.tokenIDHexStrToFeeRecieverID = {};
        for (const { tokenID, stateID } of feeRecievers) {
            const tokenIDHex = BigNumber.from(tokenID).toHexString();
            const bnStateID = BigNumber.from(stateID);
            
            this.tokenIDHexStrToQueue[tokenIDHex] = [];
            this.tokenIDHexStrToFeeRecieverID[tokenIDHex] = bnStateID;
        }

        this.txCount = 0;
    }

    public size(tokenID?: BigNumber): number {
        if (!tokenID) {
            return this.txCount;
        }
        const queue = this.tokenIDHexStrToQueue[tokenID.toHexString()];
        if (!queue) {
            return 0;
        }
        return queue.length;
    }

    public async push(tx: Item): Promise<void> {
        if (this.txCount > this.maxSize) {
            throw new Error(`MultiTokenPool: max size ${this.maxSize} reached`);
        }

        const fromState = await this.stateStorage.get(tx.fromIndex);
        // TODO State struct needs BN as well.
        const tokenQueue = this.tokenIDHexStrToQueue[fromState.tokenID];
        tokenQueue.push(tx);
    }
    // Don't care about token and their exchange rate, just compare the numeric value of fee
    // https://github.com/thehubbleproject/hubble-contracts/issues/572
    public async getHighestValueToken(): Promise<{ tokenID: BigNumber, feeReceiverID: BigNumber }> {
        let highValue = BigNumber.from(0);
        let tokenID = BigNumber.from(-1);
        for (const tokenIDHexStr of Object.keys(this.tokenIDHexStrToQueue)) {
            const value = this.getQueueValue(tokenIDHexStr);
            if (value.gt(highValue)) {
                highValue = value;
                tokenID = BigNumber.from(tokenIDHexStr);
            }
        }

        const feeReceiverID = this.tokenIDHexStrToFeeRecieverID[tokenID.toHexString()];
        return {
            tokenID,
            feeReceiverID,
        };
    }

    public pop(tokenID: BigNumber): Item {
        const tokenQueue = this.tokenIDHexStrToQueue[tokenID.toHexString()];
        tokenQueue.sort(naiveCompareFee);

        const tx = tokenQueue.pop();
        if (!tx) {
            throw new Error(`MultiTokenPool: tokenID ${tokenID.toHexString()} empty`);
        }
        return tx;
    }

    private getQueueValue(tokenIDHexStr: string): BigNumber {
        return sum(this.tokenIDHexStrToQueue[tokenIDHexStr].map(tx => tx.fee));
    }
}
