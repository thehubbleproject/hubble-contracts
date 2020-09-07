import { usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");

module.exports = {
    defaultNetwork: "buidlerevm",
    networks: {
        buidlerevm: {
            chainId: 123,
            throwOnCallFailures: false
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
        artifacts: "./build",
        tests: "./test"
    }
};
