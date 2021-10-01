export enum Usage {
    Genesis,
    Transfer,
    MassMigration,
    Create2Transfer,
    Deposit
}

export enum Result {
    Ok,
    InvalidTokenAmount,
    NotEnoughTokenBalance,
    BadFromTokenID,
    BadToTokenID,
    BadSignature,
    MismatchedAmount,
    BadWithdrawRoot,
    BadCompression,
    TooManyTx
}

export type Wei = string;

export type Vacant = {
    pathAtDepth: number;
    witness: string[];
};

export interface DeploymentParameters {
    STORAGE_DIRECTORY: string;
    MAX_DEPTH: number;
    MAX_DEPOSIT_SUBTREE_DEPTH: number;
    STAKE_AMOUNT: Wei;
    BLOCKS_TO_FINALISE: number;
    MIN_GAS_LEFT: number;
    MAX_TXS_PER_COMMIT: number;
    USE_BURN_AUCTION: boolean;
    GENESIS_STATE_ROOT?: string;

    DONATION_ADDRESS: string;
    DONATION_NUMERATOR: number;
}

export interface Hashable {
    hash(): string;
    encode(): string;
}
