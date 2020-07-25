export enum Usage {
    Genesis,
    Transfer,
    CreateAccount,
    Airdrop,
    BurnConsent,
    BurnExecution
}

export interface Account {
    ID: number;
    tokenType: number;
    balance: number;
    nonce: number;
    burn: number;
    lastBurn: number;
}

export interface AccountInclusionProof {
    pathToAccount: string;
    account: Account;
}

export interface AccountMerkleProof {
    accountIP: AccountInclusionProof;
    siblings: string[];
}

export interface PDALeaf {
    pubkey: string;
}

export interface PDAInclusionProof {
    pathToPubkey: string;
    pubkey_leaf: PDALeaf;
}

export interface PDAMerkleProof {
    _pda: PDAInclusionProof;
    siblings: string[];
}

export interface Transaction {
    txType: number;
    fromIndex: number;
    toIndex: number;
    tokenType: number;
    amount: number;
    nonce: number;
    signature?: string;
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
    NotCreatingOnZeroAccount,
    BadSignature,
    BadNonce
}

export interface CreateAccount {
    txType: number;
    toIndex: number;
    tokenType: number;
}

export interface DropTx {
    txType: number;
    fromIndex: number;
    toIndex: number;
    tokenType: number;
    nonce: number;
    amount: number;
    signature: string;
}

export interface BurnConsentTx {
    txType: number;
    fromIndex: number;
    amount: number;
    nonce: number;
    signature: string;
}

export interface BurnExecutionTx {
    txType: number;
    fromIndex: number;
    signature: string;
}

export interface AccountProofs {
    from: AccountMerkleProof;
    to: AccountMerkleProof;
}

export interface Dispute {
    batchId: number;
    txs: string[];
    signatures: string[];
    batchProofs: {
        accountProofs: AccountProofs[];
        pdaProof: PDAMerkleProof[];
    };
}
