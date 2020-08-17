import ethers from "ethers";
import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";

async function main() {
    const provider = new ethers.providers.JsonRpcProvider();
    const signer = provider.getSigner();

    const allContracts = await deployAll(signer, TESTING_PARAMS);
    Object.keys(allContracts).forEach((contract: string) => {
        console.log(contract, allContracts[contract].address);
    });
}
main();
