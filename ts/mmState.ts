import { BigNumber, BigNumberish, ethers } from "ethers";
import { solidityPack } from "ethers/lib/utils";
import { State } from "./state";

export class MMState implements State {
    public static new(
        stateID: BigNumberish,
        pubkeyID: BigNumberish,
        tokenID: BigNumberish,
        balance: BigNumberish,
        nonce: BigNumberish
    ): MMState {
        return new MMState(
            BigNumber.from(stateID),
            BigNumber.from(pubkeyID),
            BigNumber.from(tokenID),
            BigNumber.from(balance),
            BigNumber.from(nonce)
        );
    }

    constructor(
        public stateID: BigNumber,
        public pubkeyID: BigNumber,
        public tokenID: BigNumber,
        public balance: BigNumber,
        public nonce: BigNumber
    ) {}

    public encode(): string {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.stateID,
                this.pubkeyID,
                this.tokenID,
                this.balance,
                this.nonce
            ]
        );
    }

    public hash(): string {
        return ethers.utils.solidityKeccak256(
            ["uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.stateID,
                this.pubkeyID,
                this.tokenID,
                this.balance,
                this.nonce
            ]
        );
    }

    public toJSON() {
        return {
            stateID: this.stateID.toString(),
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

    public clone() {
        return new MMState(
            this.stateID,
            this.pubkeyID,
            this.tokenID,
            this.balance,
            this.nonce
        );
    }

    public toStateLeaf(): string {
        return this.hash();
    }
}
