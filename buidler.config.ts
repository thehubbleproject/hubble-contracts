import { usePlugin } from "@nomiclabs/buidler/config";
import { generateFirstWallets, mnemonics } from "./scripts/helpers/wallet";
import { ethers } from "ethers";

usePlugin("@nomiclabs/buidler-ethers");

const accounts = generateFirstWallets(mnemonics, 10).map(x => {
    return {
        privateKey: `0x${x.getPrivateKey().toString("hex")}`,
        balance: ethers.utils.parseEther("10000").toString()
    };
});

module.exports = {
    defaultNetwork: "buidlerevm",
    networks: {
        buidlerevm: {
            chainId: 123,
            accounts: accounts
        }
    },
    solc: {
        version: "0.5.15",
        optimizer: {
            enabled: true,
            runs: 200
        },
        evmVersion: "istanbul"
    },
    paths: {
        artifacts: "./build"
    }
};
