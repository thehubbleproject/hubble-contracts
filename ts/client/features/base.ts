import { BytesLike } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { Tree } from "../../tree";
import {
    Batch,
    Commitment,
    CommitmentInclusionProof,
    CompressedStruct,
    SolStruct,
    XCommitmentInclusionProof
} from "./interface";

export abstract class BaseCommitment implements Commitment {
    constructor(public stateRoot: BytesLike) {}

    abstract get bodyRoot(): BytesLike;
    public hash(): string {
        return solidityKeccak256(
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

export class ConcreteBatch<T extends Commitment> implements Batch {
    private tree: Tree;
    constructor(public readonly commitments: T[]) {
        this.tree = Tree.merklize(commitments.map(c => c.hash()));
    }

    get commitmentRoot(): string {
        return this.tree.root;
    }

    witness(leafInfex: number): string[] {
        return this.tree.witness(leafInfex).nodes;
    }

    proof(leafInfex: number): XCommitmentInclusionProof {
        return {
            commitment: this.commitments[leafInfex].toSolStruct(),
            path: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
    proofCompressed(leafInfex: number): CommitmentInclusionProof {
        return {
            commitment: this.commitments[leafInfex].toCompressedStruct(),
            path: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
}
