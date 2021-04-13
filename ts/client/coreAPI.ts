import { Genesis } from "../genesis";
import { Pubkey } from "../pubkey";
import { State } from "../state";
import { DepositPool } from "./features/deposit";
import { StorageManager } from "./storageEngine";
import { Signer } from "ethers";
import { allContracts } from "../allContractsInterfaces";

export interface ICoreAPI {
    getState(stateID: number): Promise<State>;
    updateState(stateID: number, state: State): Promise<void>;
    getPubkey(pubkeyID: number): Promise<Pubkey>;
    updatePubkey(pubkeyID: number, pubkey: Pubkey): Promise<void>;
}

export class CoreAPI implements ICoreAPI {
    private constructor(
        public readonly l2Storage: StorageManager,
        private readonly genesis: Genesis,
        public readonly depositPool: DepositPool,
        public readonly contracts: allContracts
    ) {}

    static new(l2Storage: StorageManager, genesis: Genesis, signer: Signer) {
        const depositPool = new DepositPool(
            genesis.parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );
        const contracts = genesis.getContracts(signer);
        return new this(l2Storage, genesis, depositPool, contracts);
    }

    get parameters() {
        return this.genesis.parameters;
    }

    getGenesisRoot() {
        return this.genesis.parameters.GENESIS_STATE_ROOT as string;
    }

    async getState(stateID: number): Promise<State> {
        return await this.l2Storage.state.get(stateID);
    }

    async updateState(stateID: number, state: State): Promise<void> {
        await this.l2Storage.state.update(stateID, state);
        await this.l2Storage.state.commit();
    }
    async getPubkey(pubkeyID: number): Promise<Pubkey> {
        return this.l2Storage.pubkey.get(pubkeyID);
    }
    async updatePubkey(pubkeyID: number, pubkey: Pubkey): Promise<void> {
        await this.l2Storage.pubkey.update(pubkeyID, pubkey);
        await this.l2Storage.pubkey.commit();
    }
}
