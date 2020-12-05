import * as mcl from "./mcl";
import { Tx, SignableTx } from "./tx";
import { BigNumber, BigNumberish, ethers } from "ethers";
import { solidityPack } from "ethers/lib/utils";

export interface StateSolStruct {
    pubkeyID: number;
    tokenID: number;
    balance: number;
    nonce: number;
}

/**
 * @dev this is not an zero state leaf contrarily this is a legit state!
 */
export const EMPTY_STATE: StateSolStruct = {
    pubkeyID: 0,
    tokenID: 0,
    balance: 0,
    nonce: 0
};

export class State {
    publicKey: mcl.PublicKey = ["0x", "0x", "0x", "0x"];
    secretKey: mcl.SecretKey;
    public static new(
        pubkeyID: number,
        tokenID: number,
        balance: BigNumberish,
        nonce: number
    ): State {
        return new State(pubkeyID, tokenID, BigNumber.from(balance), nonce);
    }

    // TODO add optional params for pubkey and stateID
    public clone() {
        const state = new State(
            this.pubkeyID,
            this.tokenID,
            this.balance,
            this.nonce
        );
        state.setStateID(this.stateID);
        state.publicKey = this.publicKey;
        state.secretKey = this.secretKey;
        return state;
    }

    public stateID = -1;
    constructor(
        public pubkeyID: number,
        public tokenID: number,
        public balance: BigNumber,
        public nonce: number
    ) {}

    public newKeyPair(): State {
        const keyPair = mcl.newKeyPair();
        this.publicKey = keyPair.pubkey;
        this.secretKey = keyPair.secret;
        return this;
    }

    public sign(tx: SignableTx) {
        const msg = tx.message();
        const { signature } = mcl.sign(msg, this.secretKey);
        return signature;
    }

    public setStateID(stateID: number): State {
        this.stateID = stateID;
        return this;
    }

    public setPubkey(pubkey: mcl.PublicKey): State {
        this.publicKey = pubkey;
        return this;
    }

    public getPubkey(): mcl.PublicKey {
        return this.publicKey;
    }

    public encode(): string {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256"],
            [this.pubkeyID, this.tokenID, this.balance, this.nonce]
        );
    }

    public toStateLeaf(): string {
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            [this.pubkeyID, this.tokenID, this.balance, this.nonce]
        );
    }

    public toSolStruct(): StateSolStruct {
        return {
            pubkeyID: this.pubkeyID,
            tokenID: this.tokenID,
            balance: this.balance.toNumber(),
            nonce: this.nonce
        };
    }
}
