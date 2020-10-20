"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nomiclabs/buidler/config");
config_1.usePlugin("@nomiclabs/buidler-waffle");
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
        artifacts: "./build"
    }
};
//# sourceMappingURL=buidler.config.js.map