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
        version: "0.5.15",
        settings: {
            metadata: {
                useLiteralContent: true
            },
            optimizer: {
                enabled: true,
                runs: 200,
            }
        }
    }
};
