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
