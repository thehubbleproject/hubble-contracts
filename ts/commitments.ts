import { BigNumberish, BytesLike, ethers } from "ethers";
import { ZERO_BYTES32 } from "./constants";
import { Hasher, Tree } from "./tree";

interface CompressedStruct {
    stateRoot: BytesLike;
    bodyRoot: BytesLike;
}
interface SolStruct {
    stateRoot: BytesLike;
    body: any;
}

interface CommitmentInclusionProof {
    commitment: CompressedStruct;
    pathToCommitment: number;
    witness: string[];
}

interface XCommitmentInclusionProof {
    commitment: SolStruct;
    pathToCommitment: number;
    witness: string[];
}

abstract class Commitment {
    constructor(public stateRoot: BytesLike) {}

    abstract get bodyRoot(): BytesLike;
    public hash(): string {
        return ethers.utils.solidityKeccak256(
            ["bytes32", "bytes32"],
            [this.stateRoot, this.bodyRoot]
        );
    }
    abstract toSolStruct(): SolStruct;
    public toCompressedStruct(): CompressedStruct {
        return {
            stateRoot: this.stateRoot,
            bodyRoot: this.bodyRoot
        };
    }
}

export class TransferCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike,
        accountRoot: BytesLike = ethers.constants.HashZero,
        signature: BigNumberish[] = [0, 0],
        tokenType: BigNumberish = 0,
        feeReceiver: BigNumberish = 0,
        txs: BytesLike = "0x"
    ) {
        return new TransferCommitment(
            stateRoot,
            accountRoot,
            signature,
            tokenType,
            feeReceiver,
            txs
        );
    }
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: BigNumberish[],
        public tokenType: BigNumberish,
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }
    public get bodyRoot() {
        return ethers.utils.solidityKeccak256(
            ["bytes32", "uint256[2]", "uint256", "uint256", "bytes"],
            [
                this.accountRoot,
                this.signature,
                this.tokenType,
                this.feeReceiver,
                this.txs
            ]
        );
    }
    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                tokenType: this.tokenType,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }
}

export class MassMigrationCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike,
        accountRoot: BytesLike = ethers.constants.HashZero,
        signature: BigNumberish[] = [0, 0],
        targetSpokeID: BigNumberish = 0,
        withdrawRoot: BytesLike = ethers.constants.HashZero,
        tokenID: BigNumberish = 0,
        amount: BigNumberish = 0,
        txs: BytesLike = "0x"
    ) {
        return new MassMigrationCommitment(
            stateRoot,
            accountRoot,
            signature,
            targetSpokeID,
            withdrawRoot,
            tokenID,
            amount,
            txs
        );
    }
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: BigNumberish[],
        public targetSpokeID: BigNumberish,
        public withdrawRoot: BytesLike,
        public tokenID: BigNumberish,
        public amount: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }

    public get bodyRoot() {
        return ethers.utils.solidityKeccak256(
            [
                "bytes32",
                "uint256[2]",
                "uint256",
                "bytes32",
                "uint256",
                "uint256",
                "bytes"
            ],
            [
                this.accountRoot,
                this.signature,
                this.targetSpokeID,
                this.withdrawRoot,
                this.tokenID,
                this.amount,
                this.txs
            ]
        );
    }
    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                targetSpokeID: this.targetSpokeID,
                withdrawRoot: this.withdrawRoot,
                tokenID: this.tokenID,
                amount: this.amount,
                txs: this.txs
            }
        };
    }
}

export class CommitmentTree {
    private tree: Tree;
    constructor(public readonly commitments: Commitment[]) {
        const depth = Math.ceil(Math.log2(commitments.length + 1));
        this.tree = Tree.new(depth, Hasher.new("bytes", ZERO_BYTES32));
        for (const [index, commitment] of commitments.entries()) {
            this.tree.updateSingle(index, commitment.hash());
        }
    }

    get root(): string {
        return this.tree.root;
    }

    witness(leafInfex: number): string[] {
        return this.tree.witness(leafInfex).nodes;
    }

    proof(leafInfex: number): XCommitmentInclusionProof {
        return {
            commitment: this.commitments[leafInfex].toSolStruct(),
            pathToCommitment: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
    proofCompressed(leafInfex: number): CommitmentInclusionProof {
        return {
            commitment: this.commitments[leafInfex].toCompressedStruct(),
            pathToCommitment: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
}
