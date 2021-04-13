import { arrayify } from "@ethersproject/bytes";
import { assert } from "chai";
import { providers } from "ethers";
import { ethers } from "hardhat";
import { CoreAPI } from "../../ts/client/coreAPI";
import {
    SimulatorPool,
    TransferPackingCommand
} from "../../ts/client/features/transfer";
import { SyncerService } from "../../ts/client/services/syncer";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { deployKeyless } from "../../ts/deployment/deploy";
import { Group, storageManagerFactory } from "../../ts/factory";
import { Genesis } from "../../ts/genesis";
import * as mcl from "../../ts/mcl";

describe("Client Integration", function() {
    it("run", async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        const provider = signer.provider as providers.Provider;
        const genesisEth1Block = await provider.getBlockNumber();
        await deployKeyless(signer, false);
        const group = Group.new({ n: 32 });
        const storagePacker = await storageManagerFactory(group);
        const storageSyncer = await storageManagerFactory(group);

        const parameters = PRODUCTION_PARAMS;
        parameters.USE_BURN_AUCTION = false;
        parameters.GENESIS_STATE_ROOT = storagePacker.state.root;

        const contracts = await deployAll(signer, parameters);
        const appID = await contracts.rollup.appID();
        group.setupSigners(arrayify(appID));

        const simPool = new SimulatorPool(group, storagePacker.state);
        await simPool.setTokenID();
        const genesis = await Genesis.fromContracts(
            contracts,
            parameters,
            genesisEth1Block
        );

        const apiPacker = CoreAPI.new(storagePacker, genesis, provider, signer);
        const apiSyncer = CoreAPI.new(storageSyncer, genesis, provider, signer);

        const packingCommand = new TransferPackingCommand(
            apiPacker.parameters,
            apiPacker.l2Storage,
            simPool,
            apiPacker.rollup,
            apiPacker.verifier
        );
        for (let i = 0; i < 10; i++) {
            await packingCommand.packAndSubmit();
        }

        const syncService = new SyncerService(apiSyncer);
        await syncService.initialSync();
        assert.equal(storageSyncer.state.root, storagePacker.state.root);
    }).timeout(300000);
});
