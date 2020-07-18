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
  fromIndex: number;
  toIndex: number;
  tokenType: number;
  amount: number;
  txType: number;
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
  InvalidCancelBurnAmount,
  InvalidBurnAmount,
  BadFromIndex,
  BurnAlreadyExecuted,
  NotCreatingOnZeroAccount,
  BadSignature,
}


export interface CreateAccount {
  toIndex: number;
  tokenType: number;
  signature: string;
}
