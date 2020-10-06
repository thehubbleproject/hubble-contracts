import * as mcl from "./mcl";
import { Tx, SignableTx } from "./tx";
import { BigNumber, BigNumberish, ethers } from "ethers";
import { solidityPack } from "ethers/lib/utils";

export interface StateSolStruct {
    pubkeyIndex: number;
    tokenType: number;
    balance: number;
    nonce: number;
}

/**
 * @dev this is not an zero state leaf contrarily this is a legit state!
 */
export const EMPTY_STATE: StateSolStruct = {
    pubkeyIndex: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0
};

export class State {
    publicKey: mcl.PublicKey = ["0x", "0x", "0x", "0x"];
    secretKey: mcl.SecretKey;
    public static new(
        pubkeyIndex: number,
        tokenType: number,
        balance: BigNumberish,
        nonce: number
    ): State {
        return new State(
            pubkeyIndex,
            tokenType,
            BigNumber.from(balance),
            nonce
        );
    }

    // TODO add optional params for pubkey and stateID
    public clone() {
        return new State(
            this.pubkeyIndex,
            this.tokenType,
            this.balance,
            this.nonce
        );
    }

    public stateID = -1;
    constructor(
        public pubkeyIndex: number,
        public tokenType: number,
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
            [this.pubkeyIndex, this.tokenType, this.balance, this.nonce]
        );
    }

    public toStateLeaf(): string {
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            [this.pubkeyIndex, this.tokenType, this.balance, this.nonce]
        );
    }

    public toSolStruct(): StateSolStruct {
        return {
            pubkeyIndex: this.pubkeyIndex,
            tokenType: this.tokenType,
            balance: this.balance.toNumber(),
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
