import { Tree } from "./tree";
import { State, EMPTY_STATE, StateSolStruct } from "./state";
import { TxTransfer, TxMassMigration } from "./tx";
import { BigNumber } from "ethers";

interface ProofTransferTx {
    senderAccount: StateSolStruct
    receiverAccount: StateSolStruct;
    senderWitness: string[];
    receiverWitness: string[];
    safe: boolean;
}
interface ProofTransferFee {
    feeReceiverAccount: StateSolStruct;
    feeReceiverWitness: string[];
    safe: boolean;
}

type ProofTransferBatch = ProofTransferTx[];

interface ProofOfMassMigrationTx {
    account: StateSolStruct;
    witness: string[];
    safe: boolean;
}

const STATE_WITNESS_LENGHT = 32;
const ZERO =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
const PLACEHOLDER_PROOF_ACC = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0
};
const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(ZERO);
const PLACEHOLDER_TRANSFER_PROOF = {
    senderAccount: PLACEHOLDER_PROOF_ACC,
    receiverAccount: PLACEHOLDER_PROOF_ACC,
    senderWitness: PLACEHOLDER_PROOF_WITNESS,
    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};

export class StateTree {
    public static new(stateDepth: number) {
        return new StateTree(stateDepth);
    }
    private stateTree: Tree;
    private accounts: { [key: number]: State } = {};
    constructor(stateDepth: number) {
        this.stateTree = Tree.new(stateDepth);
    }

    public getAccountWitness(stateID: number) {
        return this.stateTree.witness(stateID).nodes;
    }

    public createAccount(account: State) {
        const stateID = account.stateID;
        if (this.accounts[stateID]) {
            throw new Error("state id is in use");
        }
        const leaf = account.toStateLeaf();
        this.stateTree.updateSingle(stateID, leaf);
        this.accounts[stateID] = account;
    }

    public get root() {
        return this.stateTree.root;
    }

    public applyTransferBatch(
        txs: TxTransfer[],
        feeReceiverID: number
    ): {
        proof: ProofTransferBatch;
        feeProof: ProofTransferFee;
        safe: boolean;
    } {
        let safe = true;
        let proofs: ProofTransferTx[] = [];
        for (let i = 0; i < txs.length; i++) {
            if (safe) {
                const proof = this.applyTxTransfer(txs[i]);
                proofs.push(proof);
                safe = proof.safe;
            } else {
                proofs.push(PLACEHOLDER_TRANSFER_PROOF);
            }
        }
        const sumOfFee = txs.map(tx => tx.fee).reduce((a, b) => a.add(b));
        const feeProof = this.applyFee(sumOfFee, feeReceiverID);
        safe = feeProof.safe;
        return { proof: proofs, feeProof, safe };
    }

    public applyFee(
        sumOfFee: BigNumber,
        feeReceiverID: number
    ): ProofTransferFee {
        const account = this.accounts[feeReceiverID];

        if (account) {
            const accountStruct = account.toSolStruct();
            const witness = this.stateTree.witness(feeReceiverID).nodes;
            account.balance = account.balance.add(sumOfFee);
            this.accounts[feeReceiverID] = account;
            this.stateTree.updateSingle(feeReceiverID, account.toStateLeaf());
            return {
                feeReceiverAccount: accountStruct,
                feeReceiverWitness: witness,
                safe: true
            };
        } else {
            return {
                feeReceiverAccount: PLACEHOLDER_PROOF_ACC,
                feeReceiverWitness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
        }
    }

    public applyTxTransfer(tx: TxTransfer): ProofTransferTx {
        const senderID = tx.fromIndex;
        const receiverID = tx.toIndex;

        const senderAccount = this.accounts[senderID];
        const receiverAccount = this.accounts[receiverID];

        const senderWitness = this.stateTree.witness(senderID).nodes;
        if (senderAccount && receiverAccount) {
            const senderAccStruct = senderAccount.toSolStruct();
            if (
                senderAccount.balance.lt(tx.amount.add(tx.fee)) ||
                senderAccount.tokenType != receiverAccount.tokenType
            ) {
                return {
                    senderAccount: senderAccStruct,
                    receiverAccount: PLACEHOLDER_PROOF_ACC,
                    senderWitness,
                    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
                    safe: false
                };
            }

            senderAccount.balance = senderAccount.balance.sub(
                tx.amount.add(tx.fee)
            );
            senderAccount.nonce += 1;
            this.accounts[senderID] = senderAccount;
            this.stateTree.updateSingle(senderID, senderAccount.toStateLeaf());

            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            const receiverAccStruct = receiverAccount.toSolStruct();
            receiverAccount.balance = receiverAccount.balance.add(tx.amount);
            this.accounts[receiverID] = receiverAccount;
            this.stateTree.updateSingle(
                receiverID,
                receiverAccount.toStateLeaf()
            );

            return {
                senderAccount: senderAccStruct,
                senderWitness,
                receiverAccount: receiverAccStruct,
                receiverWitness,
                safe: true
            };
        } else {
            if (!senderAccount) {
                return {
                    senderAccount: EMPTY_STATE,
                    receiverAccount: PLACEHOLDER_PROOF_ACC,
                    senderWitness,
                    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
                    safe: false
                };
            }
            const senderAccStruct = senderAccount.toSolStruct();
            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            return {
                senderAccount: senderAccStruct,
                senderWitness,
                receiverAccount: EMPTY_STATE,
                receiverWitness: receiverWitness,
                safe: false
            };
        }
    }

    public applyMassMigration(tx: TxMassMigration): ProofOfMassMigrationTx {
        const senderID = tx.fromIndex;
        if (tx.toIndex != 0) {
            return {
                account: PLACEHOLDER_PROOF_ACC,
                witness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
        }
        const senderAccount = this.accounts[senderID];
        const senderWitness = this.stateTree.witness(senderID).nodes;
        const senderAccStruct = senderAccount.toSolStruct();
        if (senderAccount.balance.lt(tx.amount)) {
            return {
                account: PLACEHOLDER_PROOF_ACC,
                witness: PLACEHOLDER_PROOF_WITNESS,
                safe: false
            };
        }
        senderAccount.balance = senderAccount.balance.sub(tx.amount);
        senderAccount.nonce += 1;
        this.accounts[senderID] = senderAccount;
        this.stateTree.updateSingle(senderID, senderAccount.toStateLeaf());
        return {
            account: senderAccStruct,
            witness: senderWitness,
            safe: true
        };
    }
}
