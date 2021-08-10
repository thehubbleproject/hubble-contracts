import { Status } from "./client/storageEngine/transactions/constants";

export class HubbleError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "HubbleError";
    }
}

export class EncodingError extends HubbleError {
    constructor(message?: string) {
        super(message);
        this.name = "EncodingError";
    }
}

export class GenesisNotSpecified extends HubbleError {
    constructor(message?: string) {
        super(message);
        this.name = "GenesisNotSpecified";
    }
}

export class UserNotExist extends HubbleError {
    constructor(message?: string) {
        super(message);
        this.name = "UserNotExist";
    }
}

export class TreeException extends HubbleError {
    constructor(message?: string) {
        super(message);
        this.name = "TreeException";
    }
}

class AccountTreeException extends HubbleError {
    constructor(message?: string) {
        super(message);
        this.name = "AccountTreeException";
    }
}

class StateTreeExceptions extends HubbleError {
    constructor(message?: string) {
        super(message);
        this.name = "StateTreeExceptions";
    }
}

// TreeException

export class ExceedTreeSize extends TreeException {
    constructor(message?: string) {
        super(message);
        this.name = "ExceedTreeSize";
    }
}

export class BadMergeAlignment extends TreeException {
    constructor(message?: string) {
        super(message);
        this.name = "BadMergeAlignment";
    }
}

export class EmptyArray extends TreeException {
    constructor(message?: string) {
        super(message);
        this.name = "EmptyArray";
    }
}

export class MismatchLength extends TreeException {
    constructor(message?: string) {
        super(message);
        this.name = "MismatchLength";
    }
}

export class MismatchHash extends TreeException {
    constructor(message?: string) {
        super(message);
        this.name = "MismatchHash";
    }
}

export class NegativeIndex extends TreeException {
    constructor(message?: string) {
        super(message);
        this.name = "NegativeIndex";
    }
}

// AccountTreeException
export class RegistrationFail extends AccountTreeException {
    constructor(message?: string) {
        super(message);
        this.name = "HubbleError";
        RegistrationFail;
    }
}

export class WrongBatchSize extends AccountTreeException {
    constructor(message?: string) {
        super(message);
        this.name = "WrongBatchSize";
    }
}

// StateTreeExceptions

export class ExceedStateTreeSize extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "ExceedStateTreeSize";
    }
}

export class SenderNotExist extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "SenderNotExist";
    }
}

export class ReceiverNotExist extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "ReceiverNotExist";
    }
}

export class StateAlreadyExist extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "StateAlreadyExist";
    }
}

export class WrongTokenID extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "WrongTokenID";
    }
}

export class InsufficientFund extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "InsufficientFund";
    }
}

export class ZeroAmount extends StateTreeExceptions {
    constructor(message?: string) {
        super(message);
        this.name = "ZeroAmount";
    }
}

// StorageEngineExceptions

export class TreeAtLevelIsFull extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "TreeAtLevelIsFull";
    }
}

// TransactionExceptions

export class TransactionDoesNotExist extends Error {
    constructor(hash: string) {
        super(`transaction ${hash} does not exists`);
        this.name = "TransactionDoesNotExist";
    }
}

export class TransactionAlreadyExists extends Error {
    constructor(message: string) {
        super(`transaction ${message} already exists`);
        this.name = "TransactionAlreadyExists";
    }
}

export class StatusTransitionInvalid extends Error {
    constructor(cur: Status, next: Status) {
        super(`cannot transition from status ${cur} to ${next}`);
        this.name = "StatusTransitionInvalid";
    }
}

// GenesisBatchSyncExceptions

export class NotFirstBatch extends Error {
    constructor() {
        super("genesis batch must be first batch");
        this.name = "NotFirstBatch";
    }
}

export class GenesisBatchCommitmentRootMismatch extends Error {
    constructor(l1CommitmentRoot: string, l2CommitmentRoot: string) {
        super(
            `genesis batch commitmentRoot for l1 and l2 do not match. actual (l1): ${l1CommitmentRoot}, expected (l2): ${l2CommitmentRoot}`
        );
        this.name = "GenesisBatchCommitmentRootMismatch";
    }
}

// ConfigurationExceptions

export class MissingConfigPropError extends Error {
    constructor(prop: string) {
        super(`missing ${prop}`);
        this.name = "MissingConfigPropError";
    }
}

export class EmptyConfigPropError extends Error {
    constructor(prop: string) {
        super(`${prop} is empty`);
        this.name = "EmptyConfigPropError";
    }
}

// TransactionPoolExceptions

export class PoolFullError extends Error {
    constructor(maxSize: number) {
        super(`pool full, max size of ${maxSize} reached`);
        this.name = "PoolFullError";
    }
}

export class PoolEmptyError extends Error {
    constructor() {
        super("pool empty");
        this.name = "PoolEmptyError";
    }
}

export class TokenPoolEmpty extends Error {
    constructor(tokenID: string) {
        super(`pool for tokenID ${tokenID} empty`);
        this.name = "TokenPoolEmpty";
    }
}

export class TokenNotConfiguredError extends Error {
    constructor(tokenID: string) {
        super(`tokenID ${tokenID} not configured`);
        this.name = "TokenNotConfiguredError";
    }
}

export class TokenPoolHighestFeeError extends Error {
    constructor() {
        super("unable to determine highest fee token for pool");
        this.name = "TokenPoolHighestFeeError";
    }
}
