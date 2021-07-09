import { BigNumber, BigNumberish, ethers, Event } from "ethers";
import { BytesLike, solidityPack } from "ethers/lib/utils";
import { Hashable } from "./interfaces";

export class State implements Hashable {
    public static new(
        pubkeyID: BigNumberish,
        tokenID: BigNumberish,
        balance: BigNumberish,
        nonce: BigNumberish
    ): State {
        return new State(
            BigNumber.from(pubkeyID),
            BigNumber.from(tokenID),
            BigNumber.from(balance),
            BigNumber.from(nonce)
        );
    }

    static fromEncoded(data: BytesLike): State {
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

    static fromDepositQueuedEvent(event: Event): State {
        if (!event.args) {
            throw new Error("DepositQueued event missing args");
        }
        const { pubkeyID, tokenID, l2Amount } = event.args;
        return State.new(pubkeyID, tokenID, l2Amount, 0);
    }

    public clone() {
        return new State(this.pubkeyID, this.tokenID, this.balance, this.nonce);
    }

    constructor(
        public pubkeyID: BigNumber,
        public tokenID: BigNumber,
        public balance: BigNumber,
        public nonce: BigNumber
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
    public toJSON() {
        return {
            pubkeyID: this.pubkeyID.toString(),
            tokenID: this.tokenID.toString(),
            balance: this.balance.toString(),
            nonce: this.nonce.toString()
        };
    }
    public toString(): string {
        const propsStr = Object.entries(this.toJSON())
            .map(([k, v]) => `${k} ${v}`)
            .join(" ");
        return `<State  ${propsStr}>`;
    }
}

export const ZERO_STATE = State.new(0, 0, 0, 0);
