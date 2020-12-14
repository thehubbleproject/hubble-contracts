# Hubble Optimistic Rollup Contracts

![Node.js CI](https://github.com/thehubbleproject/RedditHubble/workflows/Node.js%20CI/badge.svg)

## About Hubble

Hubble is a token transfer solution to improve Ethereum throughput from 20 transactions per second to the order of 2000.

### How it work

People sumit transfers to a coordinator, who then submits transactions and the state root of the balances update to a Ethereum contract.

### Why can that improve the throughput

The contract does not validate either the correctness of the balances update or the authenticity of the sender.

### What if the coordinator submit incorrect balances update?

Anyone can trigger the dispute methods of the contract and penalize the coordinator by burning the assets they staked beforehand. The contract rolls back to the last state when the balance was correct.

### How is it different from these projects

- Optimism: Hubble does not support virtual machine, ... yet.
- ZK rollups: Both improve throughput but Hubble is ZK free. No zero-knowledge moon math, only boring EVM at work.
- ZK optimistic rollups: Hubble does not address privacy.

Hubble has the highest highest throughput compared with all above applications, since

- We use BLS signature aggregation to reduce the size to store data on chain
- We optimize for simple transfer

### What else can Hubble do

- Mass Migration: Users can migrate their tokens to other layer 2 solutions without withdraw to and deposit from layer 1 again.
- Create2Transfer: Users can onboard Hubble without going through layer 1. The coordinator can register pubkeys for them and they can acquire tokens from holders who are already in Hubble.


## Getting Started

```sh
npm install
npm run generate
```

## Testing

```sh
npm run test
```
