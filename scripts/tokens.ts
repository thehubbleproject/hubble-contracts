import { BigNumber, ethers, Signer } from "ethers";
import minimist from "minimist";
import { Genesis } from "../ts/genesis";
import * as mcl from "../ts/mcl";
import { CustomToken__factory, TokenRegistry } from "../types/ethers-contracts";

type Token = {
    name: string;
    symbol: string;
};

/**
 * Script which creates and registers 4 test tokens
 *
 * options:
 * --key ETH1 private key (default: ethers.js default signer)
 * --url ETH1 provider (default: http://localhost:8545)
 * --genesisPath Path to genesis.json (default: ./genesis.json)
 *
 */
const { key, url, genesisPath } = minimist(process.argv.slice(2), {
    string: ["key", "url", "genesisPath"]
});

const customTokens: Token[] = [
    {
        name: "RocketMan",
        symbol: "RM"
    },
    {
        name: "MajorTom",
        symbol: "MT"
    },
    {
        name: "IntergalaticPlanetary",
        symbol: "IP"
    },
    {
        name: "BlackHoleSun",
        symbol: "BHS"
    }
];

async function createToken(
    signer: Signer,
    { name, symbol }: Token
): Promise<string> {
    console.log(`creating token ${name} (${symbol})`);
    const token = await new CustomToken__factory(signer).deploy(name, symbol);
    const l1Txn = token.deployTransaction;
    console.log("    token creation sent", l1Txn.hash);
    await l1Txn.wait(1);
    console.log("    token creation confirmed", l1Txn.hash);
    console.log(
        `  token ${name} (${symbol}) created at address ${token.address}`
    );
    return token.address;
}

async function registerToken(
    tokenRegistry: TokenRegistry,
    tokenAddress: string
): Promise<BigNumber> {
    console.log(`  registering token at ${tokenAddress}`);
    const requestL1Txn = await tokenRegistry.requestRegistration(tokenAddress);
    console.log("    token registration request sent", requestL1Txn.hash);
    await requestL1Txn.wait(1);
    console.log("    token registration request confirmed", requestL1Txn.hash);

    const finaliseL1Txn = await tokenRegistry.finaliseRegistration(
        tokenAddress
    );
    console.log("    token registration finalisation sent", finaliseL1Txn.hash);
    const finaliseTxnReceipt = await finaliseL1Txn.wait(1);
    console.log(
        "    token registration finalisation confirmed",
        finaliseL1Txn.hash
    );
    const [registeredTokenLog] = finaliseTxnReceipt.logs
        .map(log => tokenRegistry.interface.parseLog(log))
        .filter(log => log.signature === "RegisteredToken(uint256,address)");
    return registeredTokenLog.args.tokenID;
}

async function createRegisterToken(
    signer: Signer,
    tokenRegistry: TokenRegistry,
    token: Token
): Promise<BigNumber> {
    const tokenAddress = await createToken(signer, token);
    const tokenID = await registerToken(tokenRegistry, tokenAddress);
    console.log(
        `token ${token.name} (${token.symbol}) created at ${tokenAddress}, registered as tokenID ${tokenID}`
    );
    return tokenID;
}

async function main() {
    await mcl.init();

    console.log("starting token registration");
    console.log(
        `tokens (${customTokens.length}): `,
        JSON.stringify(customTokens, null, 4)
    );

    const provider = new ethers.providers.JsonRpcProvider(
        url ?? "http://localhost:8545"
    );
    const signer = key
        ? new ethers.Wallet(key).connect(provider)
        : provider.getSigner();

    const genesis = await Genesis.fromConfig(genesisPath);
    const contracts = genesis.getContracts(signer);

    for (const token of customTokens) {
        await createRegisterToken(signer, contracts.tokenRegistry, token);
    }

    console.log("token registration complete");
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
