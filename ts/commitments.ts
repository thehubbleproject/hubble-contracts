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
    abstract toBatch(): Promise<Batch>;
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
    public async toBatch(): Promise<Batch> {
        return Batch.new([this]);
    }
}

export async function getGenesisProof(
    stateRoot: BytesLike
): Promise<CommitmentInclusionProof> {
    const bodyLessCommitment = new BodylessCommitment(stateRoot);
    return (await bodyLessCommitment.toBatch()).proofCompressed(0);
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
    public async toBatch() {
        return await TransferBatch.new([this]);
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
    public static async fromStateProvider(
        accountRoot: BytesLike,
        txs: TxMassMigration[],
        signature: solG1,
        feeReceiver: number,
        stateProvider: StateProvider
    ) {
        const states = [];
        for (const tx of txs) {
            const origin = (await stateProvider.getState(tx.fromIndex)).state;
            const destination = State.new(
                origin.pubkeyID,
                origin.tokenID,
                tx.amount,
                0
            );
            states.push(destination);
        }
        const migrationTree = await MigrationTree.fromStates(states);
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
    public async toBatch() {
        return await MassMigrationBatch.new([this]);
    }
}

export class Create2TransferCommitment extends TransferCommitment {
    public async toBatch(): Promise<Create2TransferBatch> {
        return await Create2TransferBatch.new([this]);
    }
}

export class Batch {
    public tree: MemoryTree = MemoryTree.new(1);
    constructor(public readonly commitments: Commitment[]) {}

    static async new(commitments: Commitment[]) {
        const batch = new Batch(commitments);
        batch.tree = await MemoryTree.merklize(commitments.map(c => c.hash()));
        return batch;
    }

    get commitmentRoot(): string {
        return this.tree.root;
    }

    async witness(leafIndex: number): Promise<string[]> {
        return (await this.tree.witness(leafIndex)).nodes;
    }

    async proof(leafIndex: number): Promise<XCommitmentInclusionProof> {
        return {
            commitment: this.commitments[leafIndex].toSolStruct(),
            path: leafIndex,
            witness: await this.witness(leafIndex)
        };
    }
    async proofCompressed(
        leafIndex: number
    ): Promise<CommitmentInclusionProof> {
        return {
            commitment: this.commitments[leafIndex].toCompressedStruct(),
            path: leafIndex,
            witness: await this.witness(leafIndex)
        };
    }
}

export async function batchFactory(
    batchType: Usage,
    txDescription: TransactionDescription,
    accountRoot: string
): Promise<Batch> {
    if (batchType == Usage.Transfer) {
        return await TransferBatch.fromCalldata(txDescription, accountRoot);
    } else if (batchType == Usage.MassMigration) {
        return await MassMigrationBatch.fromCalldata(
            txDescription,
            accountRoot
        );
    } else if (batchType == Usage.Create2Transfer) {
        return await MassMigrationBatch.fromCalldata(
            txDescription,
            accountRoot
        );
    } else {
        throw new Error(`Invalid or unimplemented batchType ${batchType}`);
    }
}

export class TransferBatch extends Batch {
    constructor(public readonly commitments: TransferCommitment[]) {
        super(commitments);
    }

    static async new(commitments: TransferCommitment[]) {
        const transferBatch = new TransferBatch(commitments);
        transferBatch.tree = await MemoryTree.merklize(
            commitments.map(c => c.hash())
        );
        return transferBatch;
    }

    static async fromCalldata(
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
        return await TransferBatch.new(commitments);
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

    static async new(commitments: MassMigrationCommitment[]) {
        const massMigrationBatch = new MassMigrationBatch(commitments);
        massMigrationBatch.tree = await MemoryTree.merklize(
            commitments.map(c => c.hash())
        );
        return massMigrationBatch;
    }

    static async fromCalldata(
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
        return await MassMigrationBatch.new(commitments);
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

    static async new(commitments: TransferCommitment[]) {
        const create2TransferBatch = new Create2TransferBatch(commitments);
        create2TransferBatch.tree = await MemoryTree.merklize(
            commitments.map(c => c.hash())
        );
        return create2TransferBatch;
    }

    static async fromCalldata(
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
        return await Create2TransferBatch.new(commitments);
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
