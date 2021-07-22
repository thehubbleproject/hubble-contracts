# Hubble Optimistic Rollup Contracts & NodeJS TypeScript Client (Node)

![Node.js CI](https://github.com/thehubbleproject/RedditHubble/workflows/Node.js%20CI/badge.svg)

## About Hubble

Hubble is an [ERC-20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/) token transfer solution that improves Ethereum throughput from 20 transactions per second to ~2700.

### How it works

Accounts submit transfers to a coordinator node who then submits transactions and the state root of the balance updates to an Ethereum smart contract ([Rollup.sol](./contracts/rollup/Rollup.sol)).

### How does this improve throughput?

The contract does not validate either the correctness of the balance updates or the authenticity of the sender.

### What if the coordinator submits incorrect balance updates?

Anyone can trigger the dispute methods of the contract and penalize the coordinator by burning the assets they staked beforehand. The contract rolls back to the last state when the balances were correct.

### How is it different from other Layer 2 (L2) Ethereum projects?

- [Optimism](https://optimism.io/): Hubble does not support the EVM virtual machine, ... yet.
- [ZK (zero knowledge proof) rollups](https://docs.ethhub.io/ethereum-roadmap/layer-2-scaling/zk-rollups/): Both improve throughput but Hubble is ZK free. No zero-knowledge moon math, only boring EVM at work.
- ZK optimistic rollups: Hubble does not address privacy.

Hubble has the highest throughput compared with the above, since:

- Hubble use BLS signature aggregation to reduce the size to store data on chain.
- We optimize for simple token transfers.

### What else can Hubble do

#### Mass Migration

Users can migrate their tokens to other L2 solutions without withdrawing to and depositing from Layer 1 (L1) again.

#### Create2Transfer

Users can onboard accounts to Hubble without going through L1. The coordinator can register their public keys and then they can acquire tokens from holders who are already in the Hubble L2.

## Local Development

[Local Development Setup](./docs/setup/LOCAL_DEVELOPMENT.md)

## Node Operator

[Node Operator](./docs/setup/NODE_OPERATOR.md)

## Docker

https://hub.docker.com/r/thehubbleproject/node

```sh
docker pull thehubbleproject/node:latest
# or for a specific release, ...:v0.x.y
```

See [Docker](./docker/README.md) instructions.
