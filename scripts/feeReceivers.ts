import { BigNumber, ethers, Wallet } from "ethers";
import minimist from "minimist";
import {
    DepositsFinalisedEventSyncer,
    PendingDeposit
} from "../ts/client/services/events/depositsFinalised";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { readJSON, writeJSON } from "../ts/file";
import { Genesis } from "../ts/genesis";
import * as mcl from "../ts/mcl";
import { Pubkey } from "../ts/pubkey";
import { sleep } from "../ts/utils";
import { BLSAccountRegistry, DepositManager } from "../types/ethers-contracts";

/**
 * Script which registers a pubkey and creates empty states
 * for every currently registered token.
 *
 * --key ETH1 private key REQUIRED
 * --url ETH1 provider (default: http://localhost:8545)
 * --genesisPath Path to genesis.json (default: ./genesis.json)
 * --configPath Path to JSON config file to write fee recievers to (default: ./config.local.json)
 */
const { key, url, genesisPath, configPath } = minimist(process.argv.slice(2), {
    string: ["key", "url", "genesisPath", "configPath"]
});

function validateArgv() {
    if (!key) {
        throw new Error("key must be specified");
    }
}

function getPubkeyFromWallet(wallet: Wallet): Pubkey {
    const secret = mcl.parseFr(wallet.privateKey);
    const pubkey = mcl.getPubkey(secret);
    const pubkeyG2 = mcl.g2ToHex(pubkey);
    return new Pubkey(pubkeyG2);
}

async function registerPubkey(
    acctRegistry: BLSAccountRegistry,
    pubkey: Pubkey
): Promise<BigNumber> {
    console.log("registering", pubkey.toString());
    const l1Txn = await acctRegistry.register(pubkey.pubkey);
    console.log("    pubkey registration sent", l1Txn.hash);
    const txnReceipt = await l1Txn.wait(1);
    console.log("    pubkey registration confirmed", l1Txn.hash);
    const [pubkeyRegisteredLog] = txnReceipt.logs
        .map(log => acctRegistry.interface.parseLog(log))
        .filter(
            logDesc => logDesc.signature === "SinglePubkeyRegistered(uint256)"
        );
    return pubkeyRegisteredLog.args.pubkeyID;
}

async function createDeposit(
    depositManager: DepositManager,
    pubkeyID: BigNumber,
    tokenID: BigNumber
): Promise<{ subtreeID: BigNumber; depositID: BigNumber }> {
    console.log(
        `creating fee receiver state for tokenID ${tokenID.toString()}`
    );
    const zeroBalanceAmount = BigNumber.from(0);
    const l1Txn = await depositManager.depositFor(
        pubkeyID,
        zeroBalanceAmount,
        tokenID
    );
    console.log("    deposit sent", l1Txn.hash);
    await l1Txn.wait(1);
    console.log("    deposit confirmed", l1Txn.hash);

    const depositQueuedEvents = await depositManager.queryFilter(
        depositManager.filters.DepositQueued(),
        l1Txn.blockHash
    );
    const depositQueuedEvent = depositQueuedEvents.find(
        e => e.transactionHash === l1Txn.hash
    );
    if (!depositQueuedEvent) {
        throw new Error(
            `unable to find DepositQueued event for L1 txn ${l1Txn.hash}`
        );
    }

    const { subtreeID, depositID } = depositQueuedEvent.args;
    return { subtreeID, depositID };
}

async function main() {
    validateArgv();
    await mcl.init();

    console.log("starting registration & generation for fee receivers");

    const provider = new ethers.providers.JsonRpcProvider(
        url ?? "http://localhost:8545"
    );
    const wallet = new ethers.Wallet(key, provider);
    const pubkey = getPubkeyFromWallet(wallet);
    console.log(`using ${pubkey.toString()}`);

    const genesis = await Genesis.fromConfig(genesisPath);
    const contracts = genesis.getContracts(wallet);

    const numTokens = await contracts.tokenRegistry.nextTokenID();
    if (numTokens.lt(1)) {
        console.log("no tokens found in registry, done");
    }

    const pubkeyID = await registerPubkey(contracts.blsAccountRegistry, pubkey);
    console.log("pubkeyID", pubkeyID.toString());

    // Create empty deposits and track
    console.log(`creating ${numTokens.toString()} fee receivers`);
    const depositEventSyncer = new DepositsFinalisedEventSyncer(
        contracts.rollup,
        PRODUCTION_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH
    );
    depositEventSyncer.listen();

    let lastDeposit: PendingDeposit | undefined;
    for (
        let tokenID = BigNumber.from(0);
        tokenID.lt(numTokens);
        tokenID = tokenID.add(1)
    ) {
        const { subtreeID, depositID } = await createDeposit(
            contracts.depositManager,
            pubkeyID,
            tokenID
        );
        lastDeposit = { tokenID, depositID };
        depositEventSyncer.addPendingDeposit(subtreeID, lastDeposit);
    }

    const lastDepositCount = 2 ** PRODUCTION_PARAMS.MAX_DEPOSIT_SUBTREE_DEPTH;
    if (lastDeposit?.depositID.lt(lastDepositCount)) {
        console.warn(
            "WARNING",
            `Last deposit is #${lastDeposit.depositID} out of ${lastDepositCount}.`,
            "You will need to wait for additional deposits before fee reciever states can be finalised/packed by a proposer"
        );
    }

    // Wait for deposits to be packed
    while (!!depositEventSyncer.getPendingDepositsCount()) {
        console.log(
            `waiting on ${depositEventSyncer.getPendingDepositsCount()} deposits to be packed...`
        );
        await sleep(15000);
    }

    depositEventSyncer.stopListening();
    const { feeReceivers } = depositEventSyncer;

    console.log("feeReceivers created");
    console.log(JSON.stringify({ feeReceivers }, null, 4));

    const path = configPath ?? "config.local.json";
    console.log(`writing to ${path}`);
    const config = await readJSON(path);
    const newConfig = { ...config, feeReceivers };
    await writeJSON(path, newConfig);

    console.log("registration & generation of fee receivers complete");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
