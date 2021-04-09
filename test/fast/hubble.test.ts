import { ethers } from "hardhat";
import { allContracts } from "../../ts/allContractsInterfaces";
import { TESTING_PARAMS, ZERO_BYTES32 } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { Genesis } from "../../ts/genesis";
import { Hubble } from "../../ts/hubble";
import * as mcl from "../../ts/mcl";

describe("hubble", function() {
    it("Runs hubble", async function() {
        await mcl.init();
        const [signer] = await ethers.getSigners();
        const parameters = {
            ...TESTING_PARAMS,
            GENESIS_STATE_ROOT: ZERO_BYTES32
        };
        const contracts = await deployAll(signer, parameters);
        let addresses: { [key: string]: string } = {};
        Object.keys(contracts).map((contract: string) => {
            addresses[contract] =
                contracts[contract as keyof allContracts].address;
        });
        const dummyAux = { domain: "0xabcd", genesisEth1Block: 0, version: "" };

        const genesis = new Genesis(parameters, addresses, dummyAux);
        const hubble = Hubble.fromGenesis(genesis, signer);
    });
});
