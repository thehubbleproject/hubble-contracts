import "@nomiclabs/hardhat-ethers";

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 123,
            throwOnCallFailures: false
        }
    },
    solidity: {
        version: "0.6.12",
        settings: {
            metadata: {
                bytecodeHash: "none"
            },
            optimizer: {
                enabled: true,
                runs: 200
            },
            outputSelection: {
                "*": {
                    "*": ["metadata"]
                }
            }
        }
    }
};
