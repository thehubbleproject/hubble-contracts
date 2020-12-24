import { ethers } from "ethers";
import { toWei } from "../ts/utils";
import { BlsAccountRegistryFactory } from "../types/ethers-contracts/BlsAccountRegistryFactory";
import { DepositManagerFactory } from "../types/ethers-contracts/DepositManagerFactory";
import { ExampleTokenFactory } from "../types/ethers-contracts/ExampleTokenFactory";
import { BlsAccountRegistry } from "../types/ethers-contracts/BlsAccountRegistry";
import { TokenRegistryFactory } from "../types/ethers-contracts/TokenRegistryFactory";
import fs from "fs";

const argv = require("minimist")(process.argv.slice(2), {
    string: ["url", "tokenID", "pubkeys", "amount"]
});

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(argv.url);
    const signer = provider.getSigner();

    // read genesis
    let buf = fs.readFileSync(`genesis.json`);
    let genesis = JSON.parse(buf.toString());

    let depositManager = DepositManagerFactory.connect(
        genesis.addresses["depositManager"],
        signer
    );

    let accountRegistry = BlsAccountRegistryFactory.connect(
        genesis.addresses["blsAccountRegistry"],
        signer
    );

    let exampleToken = ExampleTokenFactory.connect(
        genesis.addresses["exampleToken"],
        signer
    );

    let tokenRegistry = TokenRegistryFactory.connect(
        genesis.addresses["tokenRegistry"],
        signer
    );

    let accIDs: number[] = [];

    if (argv.pubkeys) {
        const pubkeys = argv.pubkeys.split(",");
        accIDs = await registerPublicKeys(accountRegistry, pubkeys);
    }

    // match token address with tokenRegistry
    let tokenAddress = await tokenRegistry.callStatic.safeGetAddress(
        argv.tokenID
    );

    if (exampleToken.address != tokenAddress) {
        throw "error token address does not match";
    }

    // approve depositmanager for amount
    let amount = toWei(argv.amount);
    let approveTx = await exampleToken.approve(
        genesis.addresses["depositManager"],
        toWei(argv.amount)
    );

    console.log("token approved", approveTx.hash.toString());

    // make deposit
    for (const accID of accIDs) {
        await depositManager.depositFor(accID, amount, argv.tokenID);
    }
}

async function registerPublicKeys(
    blsAccountRegistry: BlsAccountRegistry,
    pubkeys: string[]
) {
    let accountIDs: number[] = [];
    console.log(`Registering ${pubkeys.length} public keys`);
    for (const pubkeyRaw of pubkeys) {
        const parsedPubkey = [
            pubkeyRaw.slice(64, 128),
            pubkeyRaw.slice(0, 64),
            pubkeyRaw.slice(192, 256),
            pubkeyRaw.slice(128, 192)
        ].map(_ => "0x" + _);
        console.log("Registering", parsedPubkey);
        let accID = await blsAccountRegistry.callStatic.register(parsedPubkey);
        const tx = await blsAccountRegistry.register(parsedPubkey);
        await tx.wait();
        accountIDs.push(accID.toNumber());
        console.log("Done registering pubkey", pubkeyRaw.slice(0, 5), accID);
    }
    return accountIDs;
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
