import { ethers } from "hardhat";
import { allContracts } from "../../ts/allContractsInterfaces";
import { TESTING_PARAMS, ZERO_BYTES32 } from "../../ts/constants";
import { deployAll } from "../../ts/deploy";
import { Hubble } from "../../ts/hubble";

describe("hubble", function() {
    it("Runs hubble", async function() {
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
        const hubble = Hubble.fromGenesis(parameters, addresses, signer);
    });
});
