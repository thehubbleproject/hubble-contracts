import { arrayify } from "@ethersproject/bytes";
import { assert } from "chai";
import { ethers } from "hardhat";
import { buildStrategies } from "../../ts/client/contexts";
import { DepositPool } from "../../ts/client/features/deposit";
import {
    SimulatorPool,
    TransferPackingCommand
} from "../../ts/client/features/transfer";
import { SyncerService } from "../../ts/client/services/syncer";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { deployKeyless } from "../../ts/deployment/deploy";
import { Group, storageManagerFactory } from "../../ts/factory";
import * as mcl from "../../ts/mcl";

describe("Client Integration", function() {
    it("run", async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        const genesisEth1Block = (await signer.provider?.getBlockNumber()) as number;
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

        const packingCommand = new TransferPackingCommand(
            parameters,
            storagePacker,
            simPool,
            contracts.rollup
        );
        for (let i = 0; i < 10; i++) {
            await packingCommand.packAndSubmit();
        }

        const depositPool = new DepositPool(
            parameters.MAX_DEPOSIT_SUBTREE_DEPTH
        );
        const strategies = buildStrategies(
            contracts,
            storageSyncer,
            parameters,
            depositPool
        );
        const syncService = new SyncerService(
            contracts.rollup,
            genesisEth1Block,
            strategies
        );
        await syncService.initialSync();
        assert.equal(storageSyncer.state.root, storagePacker.state.root);
    }).timeout(300000);
});
