import { BigNumber, BytesLike, Event } from "ethers";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { ZERO_BYTES32 } from "../../constants";
import {
    GenesisBatchCommitmentRootMismatch,
    NotFirstBatch
} from "../../exceptions";
import { BaseCommitment, ConcreteBatch } from "./base";
import { BatchHandlingStrategy, Batch, OffchainTx } from "./interface";

export class GenesisCommitment extends BaseCommitment {
    constructor(public readonly stateRoot: BytesLike) {
        super(stateRoot);
    }

    get bodyRoot() {
        return ZERO_BYTES32;
    }

    public toSolStruct() {
        return { stateRoot: this.stateRoot, body: {} };
    }
}

const genesisBatchID = 0;

export class GenesisHandlingStrategy implements BatchHandlingStrategy {
    constructor(
        private readonly rollup: Rollup,
        private genesisStateRoot: BytesLike
    ) {}

    private validateIsFirstBatch(batchID: number) {
        if (batchID !== genesisBatchID) {
            throw new NotFirstBatch();
        }
    }

    public async parseBatch(event: Event): Promise<Batch> {
        const batchIDBN = event.args?.batchID as BigNumber;
        const batchID = batchIDBN.toNumber();

        this.validateIsFirstBatch(batchID);

        // Reconstruct genesis batch from genesis state root
        const commitment = new GenesisCommitment(this.genesisStateRoot);
        const batch = new ConcreteBatch([commitment]);

        // Get genesis batch from L1
        const l1Batch = await this.rollup.getBatch(batchIDBN);

        // Verify match
        if (l1Batch.commitmentRoot !== batch.commitmentRoot) {
            throw new GenesisBatchCommitmentRootMismatch(
                l1Batch.commitmentRoot,
                batch.commitmentRoot
            );
        }

        return batch;
    }

    public async processBatch(_batch: Batch): Promise<OffchainTx[]> {
        // no-op
        return [];
    }
}
