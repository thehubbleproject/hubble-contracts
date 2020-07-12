
export interface Account {
    ID: number,
    tokenType: number,
    balance: number,
    nonce: number
}

export interface Transaction {
    fromIndex: number,
    toIndex: number,
    tokenType: number,
    amount: number,
    txType: number,
    nonce: number,
    signature?: string
}
