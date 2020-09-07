import { Tree } from "./tree";
import { Account, EMPTY_ACCOUNT, StateAccountSolStruct } from "./stateAccount";
import { TxTransfer } from "./tx";

interface ProofTransferTx {
    senderAccount: StateAccountSolStruct;
    receiverAccount: StateAccountSolStruct;
    senderWitness: string[];
    receiverWitness: string[];
    safe: boolean;
}
type ProofTransferBatch = ProofTransferTx[];

interface ProofAirdropTxReceiver {
    account: StateAccountSolStruct;
    witness: string[];
    safe: boolean;
}
interface ProofAirdropTxSender {
    account: StateAccountSolStruct;
    preWitness: string[];
    postWitness: string[];
    safe: boolean;
}
interface ProofAirdropBatch {
    receiverProofs: ProofAirdropTxReceiver[];
    senderProof: ProofAirdropTxSender;
    safe: boolean;
}

interface ProofBurnConsentTx {
    account: StateAccountSolStruct;
    witness: string[];
    safe: boolean;
}
type ProofBurnConsentBatch = ProofBurnConsentTx[];

interface ProofBurnExecutionTx {
    account: StateAccountSolStruct;
    witness: string[];
    safe: boolean;
}
type ProofBurnExecutionBatch = ProofBurnExecutionTx[];

interface ProofCreateAccountTx {
    witness: string[];
    safe: boolean;
}
type ProofCreateAccountBatch = ProofCreateAccountTx[];

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
    senderAccount: PLACEHOLDER_PROOF_ACC,
    receiverAccount: PLACEHOLDER_PROOF_ACC,
    senderWitness: PLACEHOLDER_PROOF_WITNESS,
    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};
const PLACEHOLDER_AIRDROP_PROOF = {
    account: PLACEHOLDER_PROOF_ACC,
    witness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};
const PLACEHOLDER_BURN_CONSENT_PROOF = {
    account: PLACEHOLDER_PROOF_ACC,
    witness: PLACEHOLDER_PROOF_WITNESS,
    safe: false
};
const PLACEHOLDER_CRATE_ACCOUNT_PROOF = {
    witness: PLACEHOLDER_PROOF_WITNESS,
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
    ): { proof: ProofTransferBatch; safe: boolean } {
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
                    senderAccount: senderAccStruct,
                    receiverAccount: PLACEHOLDER_PROOF_ACC,
                    senderWitness,
                    receiverWitness: PLACEHOLDER_PROOF_WITNESS,
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
                senderAccount: senderAccStruct,
                senderWitness,
                receiverAccount: receiverAccStruct,
                receiverWitness,
                safe: true
            };
        } else {
            if (!senderAccount) {
                return {
                    senderAccount: EMPTY_ACCOUNT,
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
                receiverAccount: EMPTY_ACCOUNT,
                receiverWitness: receiverWitness,
                safe: false
            };
        }
    }
}
