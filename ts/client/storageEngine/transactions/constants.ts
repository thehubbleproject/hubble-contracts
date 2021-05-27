export enum Status {
    // Transaction has been submitted to proposer
    Pending = "pending",
    // Transaction has been submitted as part of a batch to L1
    Submitted = "submitted",
    // Transaction was finalized on L1
    Finalized = "finalized",
    // Transaction failed for another reason
    Failed = "failed"
}
