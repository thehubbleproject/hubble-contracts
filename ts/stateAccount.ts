import * as mcl from "./mcl";
import { Tx, SignableTx } from "./tx";
import { ethers } from "ethers";

export interface StateAccountSolStruct {
    ID: number;
    tokenType: number;
    balance: number;
    nonce: number;
}

// TODO: this is not an empty accoutn contrarily this is a legit account!
export const EMPTY_ACCOUNT: StateAccountSolStruct = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0
};

export class Account {
    publicKey: mcl.PublicKey;
    secretKey: mcl.SecretKey;
    public static new(
        accountID: number,
        tokenType: number,
        balance: number,
        nonce: number
    ): Account {
        return new Account(accountID, tokenType, balance, nonce);
    }

    public stateID = -1;
    constructor(
        public accountID: number,
        public tokenType: number,
        public balance: number,
        public nonce: number
    ) {}

    public newKeyPair(): Account {
        const keyPair = mcl.newKeyPair();
        this.publicKey = keyPair.pubkey;
        this.secretKey = keyPair.secret;
        return this;
    }

    public sign(tx: SignableTx) {
        const msg = tx.message();
        const { signature, M } = mcl.sign(msg, this.secretKey);
        return signature;
    }

    public setStateID(stateID: number): Account {
        this.stateID = stateID;
        return this;
    }

    public encodePubkey(): string[] {
        return mcl.g2ToHex(this.publicKey);
    }

    public toStateLeaf(): string {
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            [this.accountID, this.balance, this.nonce, this.tokenType]
        );
    }

    public toSolStruct(): StateAccountSolStruct {
        return {
            ID: this.accountID,
            tokenType: this.tokenType,
            balance: this.balance,
            nonce: this.nonce
        };
    }

    public toAccountLeaf(): string {
        const publicKey = mcl.g2ToHex(this.publicKey);
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            publicKey
        );
    }
}
