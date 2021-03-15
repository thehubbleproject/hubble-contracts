import { arrayify } from "@ethersproject/bytes";
import { ethers } from "hardhat";
import { PRODUCTION_PARAMS } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { deployKeyless } from "../../ts/deployment/deploy";
import { Group, storageManagerFactory } from "../../ts/factory";
import * as mcl from "../../ts/mcl";

describe("Client Integration", function() {
    it("run", async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        await deployKeyless(signer, false);
        const group = Group.new({ n: 32 });
        const storageManager = await storageManagerFactory(group);

        const parameters = PRODUCTION_PARAMS;
        parameters.USE_BURN_AUCTION = false;
        parameters.GENESIS_STATE_ROOT = storageManager.state.root;

        const contracts = await deployAll(signer, parameters);
        const appID = await contracts.rollup.appID();
        group.setupSigners(arrayify(appID));
    });
});
