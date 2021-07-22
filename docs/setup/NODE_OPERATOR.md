# Setup for Node Operators

## Deps

- [NodeJS](https://nodejs.org/en/download/)
- (Recommended instead of NodeJS) [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

### install & generate

```sh
npm ci && npm run generate
```

## Deploy a new Hubble network

Skip if you're going to join an existing network

```sh
# See ./scripts/deploy.ts for additional options
npm run deploy -- \
    --url https://your.eth.provider:8545 \
    --key PRIVATE_KEY_HEX
```

## Setup fee recievers

Skip if you only need a syncing node.

This script will register your public key and setup the states where your proposer will recieve fees when active. 

Note that a proposer will need to be active on the hubble network you are joining in order to to create (pack) the new states/deposits. You may also need to create additional deposits (using the contract `DepositManager.sol:depositFor`) so that the proposer has enough deposits to pack.

```sh
# See ./scripts/feeReceivers.ts for additional options
npm run feeReceivers -- \
    --url https://your.eth.provider:8545 \
    --key PRIVATE_KEY_HEX
    --genesisPath ./genesis.json
    --configPath ./your-node-config.json
```

## Run node

```
npm run node -- --configPath ./your-node-config.json
```

## Docker/container

TODO