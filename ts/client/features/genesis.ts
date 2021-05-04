import { BytesLike, Event } from "ethers";
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
    constructor(private genesisStateRoot: BytesLike) {}
    async parseBatch(event: Event): Promise<Batch> {
        const commitment = new GenesisCommitment(this.genesisStateRoot);
        return new ConcreteBatch([commitment]);
    }
    async processBatch(batch: Batch): Promise<OffchainTx[]> {
        // No op
        return [];
    }
}
