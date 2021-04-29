import { BigNumber, BigNumberish, ethers, Event } from "ethers";
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
        return new this(
            pubkeyID.toNumber(),
            tokenID.toNumber(),
            balance,
            nonce.toNumber()
        );
    }

    static fromDepositQueuedEvent(event: Event): State {
        if (!event.args) {
            throw new Error("DepositQueued event missing args");
        }
        const { pubkeyID, tokenID, l2Amount } = event.args;
        return State.new(pubkeyID.toNumber(), tokenID.toNumber(), l2Amount, 0);
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
    public toJSON() {
        const { pubkeyID, tokenID, nonce } = this;
        const balance = this.balance.toString();
        return {
            pubkeyID,
            tokenID,
            balance,
            nonce
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
