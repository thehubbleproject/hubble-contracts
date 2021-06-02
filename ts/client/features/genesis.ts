import { BytesLike, Event } from "ethers";
import { Rollup } from "../../../types/ethers-contracts/Rollup";
import { ZERO_BYTES32 } from "../../constants";
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

export class GenesisHandlingStrategy implements BatchHandlingStrategy {
    constructor(private genesisStateRoot: BytesLike, private rollup: Rollup) {}
    async parseBatch(event: Event): Promise<Batch> {
        const batchL1 = await this.rollup.batches(0);
        const commitment = new GenesisCommitment(this.genesisStateRoot);
        const batch = new ConcreteBatch([commitment]);
        if (batch.commitmentRoot != batchL1.commitmentRoot)
            throw new Error(
                `Mismatch genesis commitment root, l2 ${batch.commitmentRoot}, l1 ${batchL1.commitmentRoot} `
            );
        return batch;
    }
    async processBatch(batch: Batch): Promise<OffchainTx[]> {
        // No op
        return [];
    }
}
