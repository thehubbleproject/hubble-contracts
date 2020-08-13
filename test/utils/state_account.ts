import * as mcl from "./mcl";
import { Tx } from "./tx";

export interface StateAccountSolStruct {
    ID: number;
    tokenType: number;
    balance: number;
    nonce: number;
    burn: number;
    lastBurn: number;
}

// TODO: this is not an empty accoutn contrarily this is a legit account!
export const EMPTY_ACCOUNT: StateAccountSolStruct = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0,
    burn: 0,
    lastBurn: 0
};

const nonceLen = 4;

export class Account {
    publicKey: mcl.PublicKey;
    secretKey: mcl.SecretKey;
    public static new(
        domain: string,
        accountID: number,
        tokenType: number,
        balance: number,
        nonce: number,
        burn: number = 0,
        lastBurn: number = 0
    ): Account {
        return new Account(
            domain,
            accountID,
            tokenType,
            balance,
            nonce,
            burn,
            lastBurn
        );
    }

    public stateID = -1;
    constructor(
        public domain: string,
        public accountID: number,
        public tokenType: number,
        public balance: number,
        public nonce: number,
        public burn: number,
        public lastBurn: number
    ) {}

    public newKeyPair(): Account {
        const keyPair = mcl.newKeyPair();
        this.publicKey = keyPair.pubkey;
        this.secretKey = keyPair.secret;
        return this;
    }

    public sign(tx: Tx) {
        const msg = tx.message(this.domain);
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
        return web3.utils.soliditySha3(
            { v: this.accountID, t: "uint256" },
            { v: this.balance, t: "uint256" },
            { v: this.nonce, t: "uint256" },
            { v: this.tokenType, t: "uint256" },
            { v: this.burn, t: "uint256" },
            { v: this.lastBurn, t: "uint256" }
        );
    }

    public toSolStruct(): StateAccountSolStruct {
        return {
            ID: this.accountID,
            tokenType: this.tokenType,
            balance: this.balance,
            nonce: this.nonce,
            burn: this.burn,
            lastBurn: this.lastBurn
        };
    }

    public toAccountLeaf(): string {
        const publicKey = mcl.g2ToHex(this.publicKey);
        return web3.utils.soliditySha3(
            { v: publicKey[0], t: "uint256" },
            { v: publicKey[1], t: "uint256" },
            { v: publicKey[2], t: "uint256" },
            { v: publicKey[3], t: "uint256" }
        );
    }
}
