import { arrayify } from "@ethersproject/bytes";
import {
    StatusTransitionInvalid,
    TransactionAlreadyExists,
    TransactionDoesNotExist
} from "../../../exceptions";
import { txDB } from "../../database/connection";
import { OffchainTx } from "../../features/interface";
import { TransferOffchainTx } from "../../features/transfer";
import { Status } from "./constants";
import {
    SubmitMeta,
    SyncMeta,
    TransactionStatus,
    TransactionStorage,
    TransationMessageOrObject
} from "./interfaces";

/**
 * levelDB implementation of TransactionStorage
 */
export class TransactionDBStorage implements TransactionStorage {
    private readonly db = txDB;

    public async get(
        msgOrTxn: TransationMessageOrObject
    ): Promise<TransactionStatus> {
        return this.fromDB(this.getMessage(msgOrTxn));
    }

    public async pending(txn: OffchainTx): Promise<TransactionStatus> {
        const txnMessage = txn.message();
        await this.throwIfAlreadyExists(txnMessage);

        const txnStatus = {
            status: Status.Pending,
            transaction: txn
        };

        await this.toDB(txnMessage, txnStatus);
        return txnStatus;
    }

    public async submitted(
        msgOrTxn: TransationMessageOrObject,
        { batchID, l1TxnHash, l1BlockIncluded }: SubmitMeta
    ): Promise<TransactionStatus> {
        const msg = this.getMessage(msgOrTxn);
        const txnStatus = await this.getStatusOrFail(msg);
        this.validateStatusTransition(txnStatus.status, Status.Submitted);
        const submittedTxnStatus = {
            ...txnStatus,
            status: Status.Submitted,
            batchID,
            l1TxnHash,
            l1BlockIncluded
        };
        await this.toDB(msg, submittedTxnStatus);
        return submittedTxnStatus;
    }

    public async finalized(
        msgOrTxn: TransationMessageOrObject
    ): Promise<TransactionStatus> {
        return this.transition(this.getMessage(msgOrTxn), Status.Finalized);
    }

    public async failed(
        msgOrTxn: TransationMessageOrObject,
        detail: string
    ): Promise<TransactionStatus> {
        return this.transition(
            this.getMessage(msgOrTxn),
            Status.Failed,
            detail
        );
    }

    public async sync(
        txn: OffchainTx,
        { batchID, l1TxnHash, l1BlockIncluded, finalized }: SyncMeta
    ): Promise<TransactionStatus> {
        const txnMessage = txn.message();
        await this.throwIfAlreadyExists(txnMessage);

        const status = finalized ? Status.Finalized : Status.Submitted;
        const txnStatus = {
            transaction: txn,
            status,
            batchID,
            l1TxnHash,
            l1BlockIncluded
        };
        await this.toDB(txnMessage, txnStatus);
        return txnStatus;
    }

    public async count(): Promise<number> {
        const stream = this.db.createKeyStream();
        let count = 0;
        for await (const _ of stream) {
            count++;
        }
        return count;
    }

    private async throwIfAlreadyExists(txnMessage: string) {
        try {
            const itemFound = await this.get(txnMessage);
            if (itemFound) {
                throw new TransactionAlreadyExists(txnMessage);
            }
        } catch (error) {
            if (error.name !== "NotFoundError") {
                throw error;
            }
        }
    }

    private getMessage(msgOrTxn: TransationMessageOrObject): string {
        if (typeof msgOrTxn === "string") {
            return msgOrTxn;
        }
        return msgOrTxn.message();
    }

    private async getStatusOrFail(message: string): Promise<TransactionStatus> {
        try {
            return await this.get(message);
        } catch (error) {
            if (error.name === "NotFoundError") {
                throw new TransactionDoesNotExist(message);
            }
            throw error;
        }
    }

    private validateStatusTransition(cur: Status, next: Status) {
        // Validate transition from pending
        if (
            cur === Status.Pending &&
            (next === Status.Submitted || next === Status.Failed)
        ) {
            return;
            // Validate transition from submited
        } else if (
            cur === Status.Submitted &&
            (next === Status.Finalized || next === Status.Failed)
        ) {
            return;
        }
        // Fail on everything else
        throw new StatusTransitionInvalid(cur, next);
    }

    private async transition(
        message: string,
        next: Status,
        detail?: string
    ): Promise<TransactionStatus> {
        const txnStatus = await this.getStatusOrFail(message);
        this.validateStatusTransition(txnStatus.status, next);
        const newTxnStatus = {
            ...txnStatus,
            status: next,
            detail
        };
        await this.toDB(message, newTxnStatus);
        return newTxnStatus;
    }

    private async toDB(msg: string, status: TransactionStatus) {
        const serialized = JSON.stringify({
            tx: status.transaction.serialize(),
            status: status.status,
            detail: status.detail,
            batchID: status.batchID,
            l1TxnHash: status.l1TxnHash,
            l1BlockIncluded: status.l1BlockIncluded
        });
        await this.db.put(msg, serialized);
    }

    private async fromDB(msg: string): Promise<TransactionStatus> {
        const object = JSON.parse(await this.db.get(msg));

        return {
            transaction: TransferOffchainTx.deserialize(arrayify(object.tx)),
            status: object.status,
            detail: object.detail,
            batchID: object.batchID,
            l1TxnHash: object.l1TxnHash,
            l1BlockIncluded: object.l1BlockIncluded
        };
    }
}
