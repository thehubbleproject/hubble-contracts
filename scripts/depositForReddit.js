const { ethers } = require("ethers");
const contractAddresses = require("../contractAddresses.json");

const tokenRegistry = require("../build/contracts/TokenRegistry.json");
const depositManager = require("../build/contracts/DepositManager.json");
const testToken = require("../build/contracts/TestToken.json");

const argv = require("minimist")(process.argv.slice(2), {
    string: ["addr", "pubkey", "amount", "tokenId"]
});

const registeredTokenEvent = new ethers.utils.Interface([
    "event RegisteredToken(uint256,address);"
]);
const depositQueuedEvent = new ethers.utils.Interface([
    "event DepositQueued(uint256,bytes,bytes);"
]);

const DefaultRedditAmount = "1,000,000,000".split(",").join("");

/*
    $ node ./scripts/depositForReddit.js \
    --addr=0x316b2Fa7C8a2ab7E21110a4B3f58771C01A71344 \
    --pubkey=0x4fd501917bfc23a84b78ce094c8ac84780d3b058873c8c86247014eda9fa572f02e42ce02ab45eb7b1b72ec0b43ff1e3e59c74be93322161e7124a0dbfcdfd24 \
    --tokenId=1
*/

async function main() {
    const redditAddress = argv.addr;
    const redditPubkey = argv.pubkey;
    const amount = argv.amount || DefaultRedditAmount;
    let tokenId;

    const provider = new ethers.providers.JsonRpcProvider();
    const signer = provider.getSigner();

    if (!argv.tokenId) {
        tokenId = await registerToken(signer);
    } else {
        tokenId = argv.tokenId;
    }

    await depositForReddit(
        signer,
        amount,
        redditAddress,
        redditPubkey,
        tokenId
    );
}

function getDeployed(signer) {
    const tokenRegistryInstance = new ethers.Contract(
        contractAddresses.TokenRegistry,
        tokenRegistry.abi,
        signer
    );
    const testTokenInstance = new ethers.Contract(
        contractAddresses.TestToken,
        testToken.abi,
        signer
    );
    const depositManagerInstance = new ethers.Contract(
        contractAddresses.DepositManager,
        depositManager.abi,
        signer
    );
    return { tokenRegistryInstance, testTokenInstance, depositManagerInstance };
}

async function waitLog(tx, interface) {
    const receipt = await tx.wait();
    const parsedLogs = receipt.logs.map(log => interface.parseLog(log));
    return parsedLogs.filter(log => log != null);
}

async function registerToken(signer) {
    const {
        tokenRegistryInstance,
        testTokenInstance,
        depositManagerInstance
    } = getDeployed(signer);

    const tx1 = await tokenRegistryInstance.requestTokenRegistration(
        testTokenInstance.address
    );
    await tx1.wait();
    const tx2 = await tokenRegistryInstance.finaliseTokenRegistration(
        testTokenInstance.address
    );
    const parsedLogs = await waitLog(tx2, registeredTokenEvent);
    const tokenId = parsedLogs[0].values[0];

    console.log("Registered ID", tokenId.toString());
    console.log("Registered Address", parsedLogs[0].values[1]);
    const tx3 = await testTokenInstance.approve(
        depositManagerInstance.address,
        ethers.utils.parseEther("1")
    );
    await tx3.wait();
    return tokenId;
}

async function depositForReddit(
    signer,
    amount,
    redditAddress,
    redditPubkey,
    tokenId
) {
    const { testTokenInstance, depositManagerInstance } = getDeployed(signer);
    await testTokenInstance.transfer(redditAddress, amount);
    console.log("redditAddress", redditAddress);
    console.log("redditPubkey", redditPubkey);
    const tx = await depositManagerInstance.depositFor(
        redditAddress,
        amount,
        tokenId,
        redditPubkey
    );
    const parsedLogs = await waitLog(tx, depositQueuedEvent);

    console.log("Queued Deposit");
    console.log("PubkeyID", parsedLogs[0].values[0].toString());
    console.log("Pubkey", parsedLogs[0].values[1]);
    console.log("Account Bytes", parsedLogs[0].values[2]);
}

main();
