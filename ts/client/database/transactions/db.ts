import {
    StatusTransitionInvalid,
    TransactionAlreadyExists,
    TransactionDoesNotExist
} from "../../../exceptions";
import { OffchainTx } from "../../features/interface";
import { Status } from "./constants";
import {
    SubmitMeta,
    SyncMeta,
    TransactionStatus,
    TransactionStorage,
    TransationMessageOrObject
} from "./interfaces";

/**
 * In memory implementation of TransactionStorage
 */
export class TransactionDatabaseStorage implements TransactionStorage {
    private readonly transactionMessageToStatus: Record<
        string,
        TransactionStatus
    >;

    constructor() {
        this.transactionMessageToStatus = {};
    }

    public async get(
        msgOrTxn: TransationMessageOrObject
    ): Promise<TransactionStatus | undefined> {
        return this.transactionMessageToStatus[this.getMessage(msgOrTxn)];
    }

    public async pending(txn: OffchainTx): Promise<TransactionStatus> {
        const txnMessage = txn.message();
        if (await this.get(txnMessage)) {
            throw new TransactionAlreadyExists(txnMessage);
        }

        const txnStatus = {
            status: Status.Pending,
            transaction: txn
        };
        this.transactionMessageToStatus[txnMessage] = txnStatus;
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
        this.transactionMessageToStatus[msg] = submittedTxnStatus;
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
        if (await this.get(txnMessage)) {
            throw new TransactionAlreadyExists(txn.toString());
        }

        const status = finalized ? Status.Finalized : Status.Submitted;
        const txnStatus = {
            transaction: txn,
            status,
            batchID,
            l1TxnHash,
            l1BlockIncluded
        };
        this.transactionMessageToStatus[txnMessage] = txnStatus;
        return txnStatus;
    }

    public count(): number {
        return Object.keys(this.transactionMessageToStatus).length;
    }

    private getMessage(msgOrTxn: TransationMessageOrObject): string {
        if (typeof msgOrTxn === "string") {
            return msgOrTxn;
        }
        return msgOrTxn.message();
    }

    private async getStatusOrFail(message: string): Promise<TransactionStatus> {
        const txnStatus = await this.get(message);
        if (!txnStatus) {
            throw new TransactionDoesNotExist(message);
        }
        return txnStatus;
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
        this.transactionMessageToStatus[message] = newTxnStatus;
        return newTxnStatus;
    }
}
