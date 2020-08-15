import { Tree } from "./tree";
import { Account, EMPTY_ACCOUNT, StateAccountSolStruct } from "./state_account";
import { TxTransfer } from "./tx";

// interface ProofTransferTx {
//     senderAccount: StateAccountSolStruct;
//     receiverAccount: StateAccountSolStruct;
//     senderWitness: string[];
//     receiverWitness: string[];
//     safe: boolean;
// }

interface AccountProof {
    account: StateAccountSolStruct;
    witness: string[];
}

interface ProofTransferTx {
    from: AccountProof;
    to: AccountProof;
    safe: boolean;
}

type ProofTransferCommitment = ProofTransferTx[];

const STATE_WITNESS_LENGHT = 32;
const ZERO =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
const PLACEHOLDER_PROOF_ACC = {
    ID: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0,
    burn: 0,
    lastBurn: 0
};
const PLACEHOLDER_PROOF_WITNESS = Array(STATE_WITNESS_LENGHT).fill(ZERO);
const PLACEHOLDER_TRANSFER_PROOF = {
    from: {
        account: PLACEHOLDER_PROOF_ACC,
        witness: PLACEHOLDER_PROOF_WITNESS
    },
    to: {
        account: PLACEHOLDER_PROOF_ACC,
        witness: PLACEHOLDER_PROOF_WITNESS
    },
    safe: false
};

export class StateTree {
    public static new(stateDepth: number) {
        return new StateTree(stateDepth);
    }
    private stateTree: Tree;
    private accounts: { [key: number]: Account } = {};
    constructor(stateDepth: number) {
        this.stateTree = Tree.new(stateDepth);
    }

    public getAccountWitness(stateID: number) {
        return this.stateTree.witness(stateID).nodes;
    }

    public createAccount(account: Account) {
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
        txs: TxTransfer[]
    ): { proof: ProofTransferCommitment; safe: boolean } {
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
        return { proof: proofs, safe };
    }

    public applyTxTransfer(tx: TxTransfer): ProofTransferTx {
        const senderID = tx.fromIndex;
        const receiverID = tx.toIndex;

        const senderAccount = this.accounts[senderID];
        const receiverAccount = this.accounts[receiverID];

        const senderWitness = this.stateTree.witness(senderID).nodes;
        if (senderAccount && receiverAccount) {
            const senderAccStruct = senderAccount.toSolStruct();
            // FIX: handle burning account
            if (
                senderAccount.balance < tx.amount ||
                senderAccount.tokenType != receiverAccount.tokenType
            ) {
                return {
                    from: {
                        account: senderAccStruct,
                        witness: senderWitness
                    },
                    to: {
                        account: PLACEHOLDER_PROOF_ACC,
                        witness: PLACEHOLDER_PROOF_WITNESS
                    },
                    safe: false
                };
            }

            senderAccount.balance -= tx.amount;
            senderAccount.nonce += 1;
            this.accounts[senderID] = senderAccount;
            this.stateTree.updateSingle(senderID, senderAccount.toStateLeaf());
            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            const receiverAccStruct = receiverAccount.toSolStruct();
            receiverAccount.balance += tx.amount;
            this.accounts[receiverID] = receiverAccount;
            this.stateTree.updateSingle(
                receiverID,
                receiverAccount.toStateLeaf()
            );

            return {
                from: {
                    account: senderAccStruct,
                    witness: senderWitness
                },
                to: {
                    account: receiverAccStruct,
                    witness: receiverWitness
                },
                safe: true
            };
        } else {
            if (!senderAccount) {
                return {
                    from: {
                        account: EMPTY_ACCOUNT,
                        witness: senderWitness
                    },
                    to: {
                        account: PLACEHOLDER_PROOF_ACC,
                        witness: PLACEHOLDER_PROOF_WITNESS
                    },
                    safe: false
                };
            }
            const senderAccStruct = senderAccount.toSolStruct();
            const receiverWitness = this.stateTree.witness(receiverID).nodes;
            return {
                from: {
                    account: senderAccStruct,
                    witness: senderWitness
                },
                to: {
                    account: EMPTY_ACCOUNT,
                    witness: receiverWitness
                },
                safe: true
            };
        }
    }
}
