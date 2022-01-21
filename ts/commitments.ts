import { TransactionDescription } from "@ethersproject/abi";
import { BigNumberish, BytesLike, ethers } from "ethers";
import { Rollup } from "../types/ethers-contracts/Rollup";
import { ZERO_BYTES32 } from "./constants";
import { Usage, Wei } from "./interfaces";
import { solG1 } from "./mcl";
import { State } from "./state";
import { MigrationTree, StateProvider } from "./stateTree";
import { MemoryTree } from "./tree/memoryTree";
import { serialize, TxMassMigration } from "./tx";
import { sum } from "./utils";

interface CompressedStruct {
    stateRoot: BytesLike;
    bodyRoot: BytesLike;
}
interface SolStruct {
    stateRoot: BytesLike;
    body: any;
}

export interface CommitmentInclusionProof {
    commitment: CompressedStruct;
    path: number;
    witness: string[];
}

interface XCommitmentInclusionProof {
    commitment: SolStruct;
    path: number;
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

export class BodylessCommitment extends Commitment {
    get bodyRoot() {
        return ZERO_BYTES32;
    }
    public toSolStruct() {
        return { stateRoot: this.stateRoot, body: {} };
    }
    public toBatch(): Batch {
        return new Batch([this]);
    }
}

export function getGenesisProof(
    stateRoot: BytesLike
): CommitmentInclusionProof {
    return new BodylessCommitment(stateRoot).toBatch().proofCompressed(0);
}

export class TransferCommitment extends Commitment {
    public static new(
        stateRoot: BytesLike = ethers.constants.HashZero,
        accountRoot: BytesLike = ethers.constants.HashZero,
        signature: solG1 = [0, 0],
        feeReceiver: BigNumberish = 0,
        txs: BytesLike = "0x"
    ) {
        return new TransferCommitment(
            stateRoot,
            accountRoot,
            signature,
            feeReceiver,
            txs
        );
    }
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: solG1,
        public feeReceiver: BigNumberish,
        public txs: BytesLike
    ) {
        super(stateRoot);
    }
    public get bodyRoot() {
        return ethers.utils.solidityKeccak256(
            ["bytes32", "uint256[2]", "uint256", "bytes"],
            [this.accountRoot, this.signature, this.feeReceiver, this.txs]
        );
    }
    public toSolStruct(): SolStruct {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
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
        signature: solG1 = [0, 0],
        spokeID: BigNumberish = 0,
        withdrawRoot: BytesLike = ethers.constants.HashZero,
        tokenID: BigNumberish = 0,
        amount: BigNumberish = 0,
        feeReceiver: BigNumberish = 0,
        txs: BytesLike = "0x"
    ) {
        return new MassMigrationCommitment(
            stateRoot,
            accountRoot,
            signature,
            spokeID,
            withdrawRoot,
            tokenID,
            amount,
            feeReceiver,
            txs
        );
    }
    public static fromStateProvider(
        accountRoot: BytesLike,
        txs: TxMassMigration[],
        signature: solG1,
        feeReceiver: number,
        stateProvider: StateProvider
    ) {
        const states = [];
        for (const tx of txs) {
            const origin = stateProvider.getState(tx.fromIndex).state;
            const destination = State.new(
                origin.pubkeyID,
                origin.tokenID,
                tx.amount,
                tx.nonce
            );
            states.push(destination);
        }
        const migrationTree = MigrationTree.fromStates(states);
        const commitment = new this(
            stateProvider.root,
            accountRoot,
            signature,
            txs[0].spokeID,
            migrationTree.root,
            states[0].tokenID,
            sum(txs.map(tx => tx.amount)),
            feeReceiver,
            serialize(txs)
        );
        return { commitment, migrationTree };
    }
    constructor(
        public stateRoot: BytesLike,
        public accountRoot: BytesLike,
        public signature: solG1,
        public spokeID: BigNumberish,
        public withdrawRoot: BytesLike,
        public tokenID: BigNumberish,
        public amount: BigNumberish,
        public feeReceiver: BigNumberish,
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
                "uint256",
                "bytes"
            ],
            [
                this.accountRoot,
                this.signature,
                this.spokeID,
                this.withdrawRoot,
                this.tokenID,
                this.amount,
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
                spokeID: this.spokeID,
                withdrawRoot: this.withdrawRoot,
                tokenID: this.tokenID,
                amount: this.amount,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }
    public toBatch() {
        return new MassMigrationBatch([this]);
    }
}

export class Create2TransferCommitment extends TransferCommitment {
    public toBatch(): Create2TransferBatch {
        return new Create2TransferBatch([this]);
    }
}

export class Batch {
    private tree: MemoryTree;
    constructor(public readonly commitments: Commitment[]) {
        this.tree = MemoryTree.merklize(commitments.map(c => c.hash()));
    }

    get commitmentRoot(): string {
        return this.tree.root;
    }

    witness(leafIndex: number): string[] {
        return this.tree.witness(leafIndex).nodes;
    }

    proof(leafIndex: number): XCommitmentInclusionProof {
        return {
            commitment: this.commitments[leafIndex].toSolStruct(),
            path: leafIndex,
            witness: this.witness(leafIndex)
        };
    }
    proofCompressed(leafIndex: number): CommitmentInclusionProof {
        return {
            commitment: this.commitments[leafIndex].toCompressedStruct(),
            path: leafIndex,
            witness: this.witness(leafIndex)
        };
    }
}

export function batchFactory(
    batchType: Usage,
    txDescription: TransactionDescription,
    accountRoot: string
): Batch {
    if (batchType == Usage.Transfer) {
        return TransferBatch.fromCalldata(txDescription, accountRoot);
    } else if (batchType == Usage.MassMigration) {
        return MassMigrationBatch.fromCalldata(txDescription, accountRoot);
    } else if (batchType == Usage.Create2Transfer) {
        return MassMigrationBatch.fromCalldata(txDescription, accountRoot);
    } else {
        throw new Error(`Invalid or unimplemented batchType ${batchType}`);
    }
}

export class TransferBatch extends Batch {
    constructor(public readonly commitments: TransferCommitment[]) {
        super(commitments);
    }

    static fromCalldata(
        txDescription: TransactionDescription,
        accountRoot: string
    ) {
        const {
            stateRoots,
            signatures,
            feeReceivers,
            txss
        } = txDescription.args;
        const commitments = [];
        for (let i = 0; i < stateRoots.length; i++) {
            const commitment = new TransferCommitment(
                stateRoots[i],
                accountRoot,
                signatures[i],
                feeReceivers[i],
                txss[i]
            );
            commitments.push(commitment);
        }
        return new this(commitments);
    }

    async submit(rollup: Rollup, batchID: BigNumberish, stakingAmount: Wei) {
        return await rollup.submitTransfer(
            batchID,
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => c.feeReceiver),
            this.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }
}

export class MassMigrationBatch extends Batch {
    constructor(public readonly commitments: MassMigrationCommitment[]) {
        super(commitments);
    }

    static fromCalldata(
        txDescription: TransactionDescription,
        accountRoot: string
    ) {
        const {
            stateRoots,
            signatures,
            meta,
            withdrawRoots,
            txss
        } = txDescription.args;
        const commitments = [];
        for (let i = 0; i < stateRoots.length; i++) {
            const [spokeID, tokenID, amount, feeReceiver] = meta[i];
            const commitment = new MassMigrationCommitment(
                stateRoots[i],
                accountRoot,
                signatures[i],
                spokeID,
                withdrawRoots[i],
                tokenID,
                amount,
                feeReceiver,
                txss[i]
            );
            commitments.push(commitment);
        }
        return new this(commitments);
    }

    async submit(rollup: Rollup, batchID: BigNumberish, stakingAmount: Wei) {
        return await rollup.submitMassMigration(
            batchID,
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => [
                c.spokeID,
                c.tokenID,
                c.amount,
                c.feeReceiver
            ]),
            this.commitments.map(c => c.withdrawRoot),
            this.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }
}

export class Create2TransferBatch extends Batch {
    constructor(public readonly commitments: TransferCommitment[]) {
        super(commitments);
    }

    static fromCalldata(
        txDescription: TransactionDescription,
        accountRoot: string
    ) {
        const {
            stateRoots,
            signatures,
            feeReceivers,
            txss
        } = txDescription.args;
        const commitments = [];
        for (let i = 0; i < stateRoots.length; i++) {
            const commitment = new Create2TransferCommitment(
                stateRoots[i],
                accountRoot,
                signatures[i],
                feeReceivers[i],
                txss[i]
            );
            commitments.push(commitment);
        }
        return new this(commitments);
    }

    async submit(rollup: Rollup, batchID: BigNumberish, stakingAmount: Wei) {
        return await rollup.submitCreate2Transfer(
            batchID,
            this.commitments.map(c => c.stateRoot),
            this.commitments.map(c => c.signature),
            this.commitments.map(c => c.feeReceiver),
            this.commitments.map(c => c.txs),
            { value: stakingAmount }
        );
    }
}
