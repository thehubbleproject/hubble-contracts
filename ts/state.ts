import { Domain, solG2 } from "./mcl";
import { SignableTx } from "./tx";
import { BigNumber, BigNumberish, ethers } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { BlsSignerInterface, NullBlsSinger, BlsSigner } from "./blsSigner";

export interface StateSolStruct {
    pubkeyID: number;
    tokenID: number;
    balance: number;
    nonce: number;
}

/**
 * @dev this is not an empty state leaf contrarily this is a legit state!
 */
export const ZERO_STATE: StateSolStruct = {
    pubkeyID: 0,
    tokenID: 0,
    balance: 0,
    nonce: 0
};

export class State {
    public signer: BlsSignerInterface = new NullBlsSinger();
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
        state.signer = this.signer;
        return state;
    }

    public stateID = -1;
    constructor(
        public pubkeyID: number,
        public tokenID: number,
        public balance: BigNumber,
        public nonce: number
    ) {}

    public newKeyPair(domain: Domain): State {
        this.signer = BlsSigner.new(domain);
        return this;
    }

    public sign(tx: SignableTx) {
        return this.signer.sign(tx.message());
    }

    public setStateID(stateID: number): State {
        this.stateID = stateID;
        return this;
    }

    public getPubkey(): solG2 {
        return this.signer.pubkey;
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
