import { BigNumber, BigNumberish, ethers } from "ethers";
import { BytesLike, solidityPack } from "ethers/lib/utils";
import { Hashable } from "./interfaces";

export class State implements Hashable {
    public static new(
        pubkeyID: number,
        tokenID: number,
        balance: BigNumberish,
        nonce: number
    ): State {
        return new State(pubkeyID, tokenID, BigNumber.from(balance), nonce);
    }

    static fromEncoded(data: BytesLike) {
        const [
            pubkeyID,
            tokenID,
            balance,
            nonce
        ] = ethers.utils.defaultAbiCoder.decode(
            ["uint256", "uint256", "uint256", "uint256"],
            data
        );
        return new this(pubkeyID, tokenID, balance, nonce);
    }

    public clone() {
        return new State(this.pubkeyID, this.tokenID, this.balance, this.nonce);
    }

    constructor(
        public pubkeyID: number,
        public tokenID: number,
        public balance: BigNumber,
        public nonce: number
    ) {}

    public encode(): string {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256"],
            [this.pubkeyID, this.tokenID, this.balance, this.nonce]
        );
    }
    public hash(): string {
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256"],
            [this.pubkeyID, this.tokenID, this.balance, this.nonce]
        );
    }

    public toStateLeaf(): string {
        return this.hash();
    }
}

export const ZERO_STATE = State.new(0, 0, 0, 0);
