import { BigNumberish, BytesLike, ethers } from "ethers";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { Tree } from "./tree";

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
    abstract toBatch(): Batch;
    public toCompressedStruct(): CompressedStruct {
        return {
            stateRoot: this.stateRoot,
            bodyRoot: this.bodyRoot
        };
    }
}

export class TransferCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike = ethers.constants.HashZero,
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
    public toBatch() {
        return new TransferBatch([this]);
    }
}

export class MassMigrationCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike = ethers.constants.HashZero,
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
    public toBatch() {
        return new MassMigrationBatch([this]);
    }
}

export class Batch {
    private tree: Tree;
    constructor(public readonly commitments: Commitment[]) {
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

export class TransferBatch extends Batch {
    constructor(public readonly commitments: TransferCommitment[]) {
        super(commitments);
    }

    async submit(rollup: Rollup, stakingAmount: string) {
        return await rollup.submitTransferBatch(
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => c.tokenType),
            this.commitments.map(c => c.feeReceiver),
            this.commitments.map(c => c.txs),
            { value: ethers.utils.parseEther(stakingAmount) }
        );
    }
}

export class MassMigrationBatch extends Batch {
    constructor(public readonly commitments: MassMigrationCommitment[]) {
        super(commitments);
    }
    async submit(rollup: Rollup, stakingAmount: string) {
        return await rollup.submitMassMigrationBatch(
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => [c.targetSpokeID, c.tokenID, c.amount]),
            this.commitments.map(c => c.withdrawRoot),
            this.commitments.map(c => c.txs),
            { value: ethers.utils.parseEther(stakingAmount) }
        );
    }
}
