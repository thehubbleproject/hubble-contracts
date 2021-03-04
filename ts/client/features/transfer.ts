import { TransactionDescription } from "@ethersproject/abi";
import { BigNumberish, BytesLike } from "ethers";
import { StorageManager } from "../storageEngine";
import { BaseCommitment, ConcreteBatch } from "./base";
import { BatchMeta, Feature, SolStruct, StateMachine } from "./interface";

export class TransferCommitment extends BaseCommitment {
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: BigNumberish[],
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }

    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }

    get bodyRoot(): string {
        throw new Error("not implemented");
    }
}

export class TransferStateMachine implements StateMachine {
    async apply(
        commitment: TransferCommitment,
        storageManager: StorageManager
    ): Promise<void> {
        throw new Error("not implemented");
    }
}

export class TransferFeature implements Feature {
    parseBatch(txDescription: TransactionDescription, batchMeta: BatchMeta) {
        const {
            stateRoots,
            signatures,
            feeReceivers,
            txss
        } = txDescription.args;
        const commitments = [];
        for (let i = 0; i < stateRoots.length; i++) {
            const commitment = new TransferCommitment(
                stateRoots[i],
                batchMeta.accountRoot,
                signatures[i],
                feeReceivers[i],
                txss[i]
            );
            commitments.push(commitment);
        }
        return new ConcreteBatch(commitments);
    }

    getStateMachine() {
        return new TransferStateMachine();
    }
}
