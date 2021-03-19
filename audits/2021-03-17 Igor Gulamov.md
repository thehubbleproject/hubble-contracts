# Hubble audit

[TOC]

## Introduction

Igor Gulamov conducted the audit of Hubble Project smart contracts and circuits.

This review was performed by an independent reviewer under fixed rate.

## Scope

Smart contracts at https://github.com/thehubbleproject/hubble-contracts, excluding test.

## Issues

We found no critical issues. One major issue found and fixed at [pull/499](https://github.com/thehubbleproject/hubble-contracts/pull/499).

We consider the commit [6abd64dac9666c6772ab9f867892cc0bca67dabd](https://github.com/thehubbleproject/hubble-contracts/commit/6abd64dac9666c6772ab9f867892cc0bca67dabd) as a safe version from the informational security point of view.

### Critical

### Major

#### Whales (in Burn auction) or operator (in POB) can lock deposits.

We do not recommend using POB chooser in production. Also, in the current implementation operator can buy out 100 blocks and go offline. We recommend adding force bids with higher amounts to replace malicious operator or implement a force withdrawal procedure.

**Fixed** at [pull/499](https://github.com/thehubbleproject/hubble-contracts/pull/499), Move POB to contracts/test/.

### Warning

#### 1 Storage allocated variable is used as an in-cycle index

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/DepositManager.sol#L68

Storage allocated variable is used as an in-cycle index. Also, lists are unoptimized data structure in solidity, each operation with a list requires additional SLOAD to check index overflow.

We propose replacing the list with the hashmap and using memory cached variables in cycles.

**Fixed** at [00b9daf683ba9cd8687caa012ee3b7cfccc4904e](https://github.com/thehubbleproject/hubble-contracts/commit/00b9daf683ba9cd8687caa012ee3b7cfccc4904e)

#### 2 Specifying explicitly precompile cost

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/libs/BLS.sol#L103

Specifying explicitly precompile cost could be unfriendly to future hardforks.

**Fixed** at [pull/409](https://github.com/thehubbleproject/hubble-contracts/pull/409)

#### 3 extended Euclidean algorithm efficiency

Source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/libs/ModExp.sol

We propose using a more efficient extended Euclidean algorithm.

**Will not fix** EEA is too expensive to do in terms of EVM gas costs

#### 4 keccak computed in runtime

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/libs/ParamManager.sol#L3-L65

Solidity does not compute keccak at compile time. We recommend replacing hash execution with final results and adding preimages in comments.

**Fixed** at [3c6e39b2b0f1b7969ae4be90fdb4fa0036735644](https://github.com/thehubbleproject/hubble-contracts/commit/3c6e39b2b0f1b7969ae4be90fdb4fa0036735644)

#### 5 merkelize damages input data

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/libs/MerkleTree.sol#L69

The current implementation of merkelize could damage input data. We recommend implement it with an additional n/2-sized buffer or recursion.

#### 6 Storage allocated variable is used as an in-cycle index

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/rollup/BatchManager.sol#L96

Storage allocated variable is used as an in-cycle index.

**Fixed** at [21bba98b7105578fd5e1e7994aa01d90a29c4196](https://github.com/thehubbleproject/hubble-contracts/commit/21bba98b7105578fd5e1e7994aa01d90a29c4196)

#### 7 Input data damage

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/AccountTree.sol#L65

Input data could be damaged.

**Fixed** at [8a77e91479a603274e92e1e078fdcca248808da9](https://github.com/thehubbleproject/hubble-contracts/commit/8a77e91479a603274e92e1e078fdcca248808da9)

#### 8 No immutable variables are used in the Rollup contract

source: https://github.com/thehubbleproject/hubble-contracts/blob/4ff3955f3faea7e61593d05a24fb8fd70ca7095f/contracts/rollup/Rollup.sol#L414

No immutable variables are used in the Rollup contract. We propose using immutables to reduce a number of `SLOAD`s.

**Fixed** at [pull/491](https://github.com/thehubbleproject/hubble-contracts/pull/491). Also add immutables to other contracts ([pull/497](https://github.com/thehubbleproject/hubble-contracts/pull/497))

#### 9 No safe ERC20 is used

source: [DepositManager.sol#L130](https://github.com/thehubbleproject/hubble-contracts/blob/4ff3955f3faea7e61593d05a24fb8fd70ca7095f/contracts/DepositManager.sol#L126) [WithdrawManager.sol#L109](https://github.com/thehubbleproject/hubble-contracts/blob/4ff3955f3faea7e61593d05a24fb8fd70ca7095f/contracts/WithdrawManager.sol#L109)

We propose using [SafeERC20.sol](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/SafeERC20.sol) to support non-standard tokens.

**Fixed** at [pull/487](https://github.com/thehubbleproject/hubble-contracts/pull/487).

#### 10 redundent storage value read/write

source: [BurnAuction.sol#L157-L158](https://github.com/thehubbleproject/hubble-contracts/blob/4ff3955f3faea7e61593d05a24fb8fd70ca7095f/contracts/proposers/BurnAuction.sol#L157-L158)

We propose caching storage value for optimization.

**Fixed** at [pull/486](https://github.com/thehubbleproject/hubble-contracts/pull/486).


### Comment

#### 1 propose to use other methods to utilize ETH to burn

source: https://github.com/thehubbleproject/hubble-contracts/blob/32234da0ce3015b4bece04a264a136a6778191dd/contracts/rollup/BatchManager.sol#L106

```
address(0).transfer(burn);
```

ETH is burned here.  We propose to use other methods to utilize ETH to burn. For example, minting gas token to reduce gas costs for rollup users.

**Will not fix**

#### 2. We propose you fix typos for better readability

https://github.com/thehubbleproject/hubble-contracts/blob/4ff3955f3faea7e61593d05a24fb8fd70ca7095f/contracts/proposers/BurnAuction.sol#L115 `witdraw` to `withdraw`

https://github.com/thehubbleproject/hubble-contracts/blob/4ff3955f3faea7e61593d05a24fb8fd70ca7095f/contracts/libs/MerkleTree.sol#L74 `merklise` to `merkelize`

**Fixed** at [pull/485](https://github.com/thehubbleproject/hubble-contracts/pull/485).

#### 3. We recommend remove not-indexed calldata-dependent fields from events for better gas optimization.

**Fixed** at [pull/489](https://github.com/thehubbleproject/hubble-contracts/pull/489).

## Severity Terms

### Comment

Comment issues are generally subjective in nature, or potentially deal with topics like "best practices" or "readability".  Comment issues in general will not indicate an actual problem or bug in code.

The maintainers should use their own judgment as to whether addressing these issues improves the codebase.

### Warning

Warning issues are generally objective in nature but do not represent actual bugs or security problems.

These issues should be addressed unless there is a clear reason not to.

### Major

Major issues will be things like bugs or security vulnerabilities.  These issues may not be directly exploitable, or may require a certain condition to arise in order to be exploited.

Left unaddressed these issues are highly likely to cause problems with the operation of the contract or lead to a situation which allows the system to be exploited in some way.

### Critical

Critical issues are directly exploitable bugs or security vulnerabilities.

Left unaddressed these issues are highly likely or guaranteed to cause major problems or potentially a full failure in the operations of the contract.
