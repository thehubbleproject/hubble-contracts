export interface DeploymentParameters {
    MAX_DEPTH: number;
    MAX_DEPOSIT_SUBTREE_DEPTH: number;
    STAKE_AMOUNT: string;
    GENESIS_STATE_ROOT?: string;
}

export enum Usage {
    Genesis,
    Transfer,
    MassMigration
}

export enum Result {
    Ok,
    InvalidTokenAddress,
    InvalidTokenAmount,
    NotEnoughTokenBalance,
    BadFromTokenType,
    BadToTokenType,
    BadFromIndex,
    NotOnDesignatedStateLeaf,
    BadSignature,
    MismatchedAmount,
    BadWithdrawRoot
}
