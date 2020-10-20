export interface DeploymentParameters {
    MAX_DEPTH: number;
    MAX_DEPOSIT_SUBTREE_DEPTH: number;
    STAKE_AMOUNT: string;
    TIME_TO_FINALISE: number;
    GENESIS_STATE_ROOT?: string;
}
export declare enum Usage {
    Genesis = 0,
    Transfer = 1,
    MassMigration = 2
}
export declare enum Result {
    Ok = 0,
    InvalidTokenAddress = 1,
    InvalidTokenAmount = 2,
    NotEnoughTokenBalance = 3,
    BadFromTokenType = 4,
    BadToTokenType = 5,
    BadFromIndex = 6,
    NotOnDesignatedStateLeaf = 7,
    BadSignature = 8,
    MismatchedAmount = 9,
    BadWithdrawRoot = 10
}
