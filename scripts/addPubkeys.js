const { ethers } = require("ethers");
const fs = require("fs");
const contractAddresses = require("../contractAddresses.json");

const paramManagerLib = require("../build/contracts/ParamManager.json");

const rollupReddit = require("../build/contracts/RollupReddit.json");
const iface = new ethers.utils.Interface([
    "event NewPubkeyAdded(uint256,bytes)"
]);

/* 
    > npm run add-pubkeys -- ./scripts/exampleData/users.json
    pubkey 0xaaaa02 pubkeyID 8
    pubkey 0xbbbb02 pubkeyID 9
*/
async function addPubkeys() {
    const provider = new ethers.providers.JsonRpcProvider();
    const rollupRedditInstance = new ethers.Contract(
        contractAddresses.RollupReddit,
        rollupReddit.abi,
        provider.getSigner()
    );
    const dataPath = process.argv[2];
    console.log("dataPath", dataPath);
    const userData = JSON.parse(fs.readFileSync(dataPath));
    const pubkeys = userData.users.map(u => u.pubkey);
    var i,
        j,
        temparray,
        chunk = 10;
    for (i = 0, j = pubkeys.length; i < j; i += chunk) {
        temparray = pubkeys.slice(i, i + chunk);
        console.log("Sending a chunk", temparray.length);
        const tx = await rollupRedditInstance.createPublickeys(temparray);
        const receipt = await tx.wait();
        const parsedLogs = receipt.logs.map(log => iface.parseLog(log));
        parsedLogs.forEach(log => {
            const pubkeyID = log.values[0].toString();
            const pubkey = log.values[1].toString();
            console.log("pubkey", pubkey, "pubkeyID", pubkeyID);
        });
    }
}

addPubkeys();
