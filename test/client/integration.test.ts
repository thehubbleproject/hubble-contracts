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
import { USDT } from "../../ts/decimal";
import { deployAll } from "../../ts/deploy";
import { deployKeyless } from "../../ts/deployment/deploy";
import { Group, storageManagerFactory } from "../../ts/factory";
import { Genesis } from "../../ts/genesis";
import * as mcl from "../../ts/mcl";
import { Pubkey } from "../../ts/pubkey";
import { State } from "../../ts/state";

describe("Client Integration", function() {
    it("run", async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        const provider = signer.provider as providers.Provider;
        const genesisEth1Block = await provider.getBlockNumber();
        await deployKeyless(signer, false);
        const storagePacker = await storageManagerFactory();
        const storageSyncer = await storageManagerFactory();

        // Setup pubkeys, state for packer & syncer
        const tokenID = 1;
        const initialBalance = USDT.fromHumanValue("100.12");
        const group = Group.new({ n: 32 });
        for (const user of group.userIterator()) {
            const state = State.new(
                user.pubkeyID,
                tokenID,
                initialBalance.l2Value,
                0
            );
            // Setup packer L2 storage
            await storagePacker.pubkey.update(
                user.pubkeyID,
                new Pubkey(user.pubkey)
            );
            await storagePacker.state.update(user.stateID, state);

            // Setup syncer L2 state
            // Replace with L1 deposits once implemented
            await storageSyncer.state.update(user.stateID, state);
        }
        await storagePacker.pubkey.commit();
        await storagePacker.state.commit();
        await storageSyncer.state.commit();

        const parameters = PRODUCTION_PARAMS;
        parameters.USE_BURN_AUCTION = false;
        parameters.GENESIS_STATE_ROOT = storagePacker.state.root;

        const contracts = await deployAll(signer, parameters);
        for (const user of group.userIterator()) {
            // Setup L1 pubkeys
            await contracts.blsAccountRegistry.register(user.pubkey);
        }

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
        assert.equal(storageSyncer.pubkey.root, storagePacker.pubkey.root);
    }).timeout(300000);
});
