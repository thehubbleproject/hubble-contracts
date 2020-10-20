"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MassMigrationBatch = exports.TransferBatch = exports.Batch = exports.MassMigrationCommitment = exports.TransferCommitment = void 0;
const ethers_1 = require("ethers");
const tree_1 = require("./tree");
class Commitment {
    constructor(stateRoot) {
        this.stateRoot = stateRoot;
    }
    hash() {
        return ethers_1.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [this.stateRoot, this.bodyRoot]);
    }
    toCompressedStruct() {
        return {
            stateRoot: this.stateRoot,
            bodyRoot: this.bodyRoot
        };
    }
}
class TransferCommitment extends Commitment {
    constructor(stateRoot, accountRoot, signature, feeReceiver, txs) {
        super(stateRoot);
        this.stateRoot = stateRoot;
        this.accountRoot = accountRoot;
        this.signature = signature;
        this.feeReceiver = feeReceiver;
        this.txs = txs;
    }
    static new(stateRoot = ethers_1.ethers.constants.HashZero, accountRoot = ethers_1.ethers.constants.HashZero, signature = [0, 0], feeReceiver = 0, txs = "0x") {
        return new TransferCommitment(stateRoot, accountRoot, signature, feeReceiver, txs);
    }
    get bodyRoot() {
        return ethers_1.ethers.utils.solidityKeccak256(["bytes32", "uint256[2]", "uint256", "bytes"], [this.accountRoot, this.signature, this.feeReceiver, this.txs]);
    }
    toSolStruct() {
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
    toBatch() {
        return new TransferBatch([this]);
    }
}
exports.TransferCommitment = TransferCommitment;
class MassMigrationCommitment extends Commitment {
    constructor(stateRoot, accountRoot, signature, targetSpokeID, withdrawRoot, tokenID, amount, feeReceiver, txs) {
        super(stateRoot);
        this.stateRoot = stateRoot;
        this.accountRoot = accountRoot;
        this.signature = signature;
        this.targetSpokeID = targetSpokeID;
        this.withdrawRoot = withdrawRoot;
        this.tokenID = tokenID;
        this.amount = amount;
        this.feeReceiver = feeReceiver;
        this.txs = txs;
    }
    static new(stateRoot = ethers_1.ethers.constants.HashZero, accountRoot = ethers_1.ethers.constants.HashZero, signature = [0, 0], targetSpokeID = 0, withdrawRoot = ethers_1.ethers.constants.HashZero, tokenID = 0, amount = 0, feeReceiver = 0, txs = "0x") {
        return new MassMigrationCommitment(stateRoot, accountRoot, signature, targetSpokeID, withdrawRoot, tokenID, amount, feeReceiver, txs);
    }
    get bodyRoot() {
        return ethers_1.ethers.utils.solidityKeccak256([
            "bytes32",
            "uint256[2]",
            "uint256",
            "bytes32",
            "uint256",
            "uint256",
            "uint256",
            "bytes"
        ], [
            this.accountRoot,
            this.signature,
            this.targetSpokeID,
            this.withdrawRoot,
            this.tokenID,
            this.amount,
            this.feeReceiver,
            this.txs
        ]);
    }
    toSolStruct() {
        return {
            stateRoot: this.stateRoot,
            body: {
                accountRoot: this.accountRoot,
                signature: this.signature,
                targetSpokeID: this.targetSpokeID,
                withdrawRoot: this.withdrawRoot,
                tokenID: this.tokenID,
                amount: this.amount,
                feeReceiver: this.feeReceiver,
                txs: this.txs
            }
        };
    }
    toBatch() {
        return new MassMigrationBatch([this]);
    }
}
exports.MassMigrationCommitment = MassMigrationCommitment;
class Batch {
    constructor(commitments) {
        this.commitments = commitments;
        this.tree = tree_1.Tree.merklize(commitments.map(c => c.hash()));
    }
    get commitmentRoot() {
        return this.tree.root;
    }
    witness(leafInfex) {
        return this.tree.witness(leafInfex).nodes;
    }
    proof(leafInfex) {
        return {
            commitment: this.commitments[leafInfex].toSolStruct(),
            pathToCommitment: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
    proofCompressed(leafInfex) {
        return {
            commitment: this.commitments[leafInfex].toCompressedStruct(),
            pathToCommitment: leafInfex,
            witness: this.witness(leafInfex)
        };
    }
}
exports.Batch = Batch;
class TransferBatch extends Batch {
    constructor(commitments) {
        super(commitments);
        this.commitments = commitments;
    }
    async submit(rollup, stakingAmount) {
        return await rollup.submitTransfer(this.commitments.map(c => c.stateRoot), this.commitments.map(c => c.signature), this.commitments.map(c => c.feeReceiver), this.commitments.map(c => c.txs), { value: ethers_1.ethers.utils.parseEther(stakingAmount) });
    }
}
exports.TransferBatch = TransferBatch;
class MassMigrationBatch extends Batch {
    constructor(commitments) {
        super(commitments);
        this.commitments = commitments;
    }
    async submit(rollup, stakingAmount) {
        return await rollup.submitMassMigration(this.commitments.map(c => c.stateRoot), this.commitments.map(c => c.signature), this.commitments.map(c => [
            c.targetSpokeID,
            c.tokenID,
            c.amount,
            c.feeReceiver
        ]), this.commitments.map(c => c.withdrawRoot), this.commitments.map(c => c.txs), { value: ethers_1.ethers.utils.parseEther(stakingAmount) });
    }
}
exports.MassMigrationBatch = MassMigrationBatch;
//# sourceMappingURL=commitments.js.map