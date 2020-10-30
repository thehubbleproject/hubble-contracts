export interface DeploymentParameters {
    MAX_DEPTH: number;
    MAX_DEPOSIT_SUBTREE_DEPTH: number;
    STAKE_AMOUNT: string;
    TIME_TO_FINALISE: number;
    GENESIS_STATE_ROOT?: string;
}

export enum Usage {
    Genesis,
    Transfer,
    MassMigration
}

export enum Result {
    Ok,
    InvalidTokenAmount,
    NotEnoughTokenBalance,
    BadFromTokenType,
    BadToTokenType,
    BadSignature,
    MismatchedAmount,
    BadWithdrawRoot,
    BadCompression,
    TooManyTx
}
