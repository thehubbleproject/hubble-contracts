import { toWei } from "../ts/utils";
import { Hubble } from "../ts/hubble";

const argv = require("minimist")(process.argv.slice(2), {
    string: ["url", "pubkeys", "amount"]
});

async function main() {
    const providerUrl = argv.url || "http://localhost:8545";

    const hubble = Hubble.fromDefault(providerUrl);

    let accIDs: number[] = [];

    if (argv.pubkeys) {
        const pubkeys = argv.pubkeys.split(",");
        accIDs = await hubble.registerPublicKeys(pubkeys);
    }
    const { tokenRegistry, exampleToken, depositManager } = hubble.contracts;

    const tokenID = 0;
    // match token address with tokenRegistry
    let tokenAddress = await tokenRegistry.callStatic.safeGetAddress(tokenID);

    if (exampleToken.address != tokenAddress) {
        throw "error token address does not match";
    }

    // approve depositmanager for amount
    const amount = parseInt(argv.amount);
    const totalAmount = accIDs.length * amount;
    let approveTx = await exampleToken.approve(
        depositManager.address,
        toWei(totalAmount.toString())
    );

    console.log("token approved", approveTx.hash.toString());

    // make deposit
    for (const accID of accIDs) {
        await depositManager.depositFor(accID, amount, tokenID);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
