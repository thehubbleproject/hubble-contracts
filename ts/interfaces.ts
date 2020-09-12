export interface DeploymentParameters {
    MAX_DEPTH: number;
    MAX_DEPOSIT_SUBTREE_DEPTH: number;
    STAKE_AMOUNT: string;
    GENESIS_STATE_ROOT?: string;
}

export enum Usage {
    Genesis,
    Transfer,
    CreateAccount,
    Airdrop,
    BurnConsent,
    BurnExecution,
    MassMigration
}

export enum ErrorCode {
    NoError,
    InvalidTokenAddress,
    InvalidTokenAmount,
    NotEnoughTokenBalance,
    BadFromTokenType,
    BadToTokenType,
    BadFromIndex,
    BurnAlreadyExecuted,
    NotOnDesignatedStateLeaf,
    NotCreatingOnZeroAccount,
    BadSignature
}
