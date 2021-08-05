import { BigNumber, Event } from "ethers";
import { Rollup } from "../../../../types/ethers-contracts";
import { FeeReceivers } from "../../config";
import { ContractEventSyncer } from "./contractEventSyncer";

export type PendingDeposit = {
    tokenID: BigNumber;
    depositID: BigNumber;
};

/**
 * Syncs DepositsFinalised events from the Rollup contract
 * Currently only used by feeReceivers script.
 */
export class DepositsFinalisedEventSyncer extends ContractEventSyncer {
    public readonly feeReceivers: FeeReceivers;
    private readonly subtreeIDToPendingDeposits: Record<
        string,
        PendingDeposit[]
    >;

    constructor(
        rollup: Rollup,
        private readonly maxDepositSubtreeDepth: number
    ) {
        super(rollup, rollup.filters.DepositsFinalised());
        this.eventListener = this.depositsFinalisedListener;

        this.feeReceivers = [];
        this.subtreeIDToPendingDeposits = {};
    }

    public async initialSync(
        _startBlock: number,
        _endBlock: number
    ): Promise<void> {
        throw new Error(
            "DepositsFinalisedEventSyncer: initialSync not implemented"
        );
    }

    public getPendingDepositsCount(): number {
        return Object.keys(this.subtreeIDToPendingDeposits).reduce(
            (acc, k) => acc + this.subtreeIDToPendingDeposits[k].length,
            0
        );
    }

    public addPendingDeposit(
        subtreeID: BigNumber,
        pendingDeposit: PendingDeposit
    ) {
        const subIDStr = subtreeID.toString();
        if (!this.subtreeIDToPendingDeposits[subIDStr]) {
            this.subtreeIDToPendingDeposits[subIDStr] = [];
        }

        this.subtreeIDToPendingDeposits[subIDStr].push(pendingDeposit);
    }

    private handleDepositsFinalised(event: Event) {
        if (!event.args) {
            throw new Error("missing event args");
        }
        const { subtreeID, pathToSubTree } = event.args;

        const subIDStr = subtreeID.toString();
        console.log(`subtree #${subIDStr} submitted`);

        const pendingDeposits = this.subtreeIDToPendingDeposits[subIDStr];
        if (!pendingDeposits) {
            throw new Error(
                `pending deposits not found for subtreeID ${subIDStr}`
            );
        }
        delete this.subtreeIDToPendingDeposits[subIDStr];

        for (const pd of pendingDeposits) {
            const stateID = pathToSubTree
                .mul(2 ** this.maxDepositSubtreeDepth)
                .add(pd.depositID);
            const tokenIDStr = pd.tokenID.toString();
            this.feeReceivers.push({
                tokenID: tokenIDStr,
                stateID: stateID.toString()
            });
            console.log(
                `deposit for tokenID ${tokenIDStr} packed.`,
                `stateID ${stateID.toString()}`
            );
        }
    }

    depositsFinalisedListener = (
        subtreeID: null,
        depositSubTreeRoot: null,
        pathToSubTree: null,
        event: Event
    ) => {
        this.handleDepositsFinalised(event);
    };
}
