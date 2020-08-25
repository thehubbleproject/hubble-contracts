import { ethers } from "ethers";
import * as ethUtils from "ethereumjs-util";
import { Account, Transaction, Usage, Wallet } from "./interfaces";
const TokenRegistry = artifacts.require("TokenRegistry");
const RollupUtils = artifacts.require("RollupUtils");
const RollupCore = artifacts.require("Rollup");
const DepositManager = artifacts.require("DepositManager");
const TestToken = artifacts.require("TestToken");
const Governance = artifacts.require("Governance");

// returns parent node hash given child node hashes
export function getParentLeaf(left: string, right: string) {
    var abiCoder = ethers.utils.defaultAbiCoder;
    var hash = ethers.utils.keccak256(
        abiCoder.encode(["bytes32", "bytes32"], [left, right])
    );
    return hash;
}

export function Hash(data: string) {
    return ethers.utils.keccak256(data);
}

export function PubKeyHash(pubkey: string) {
    var abiCoder = ethers.utils.defaultAbiCoder;
    var result = ethers.utils.keccak256(abiCoder.encode(["bytes"], [pubkey]));
    return result;
}

export function StringToBytes32(data: string) {
    return ethers.utils.formatBytes32String(data);
}

export async function CreateAccountLeaf(account: Account) {
    const rollupUtils = await RollupUtils.deployed();
    const result = await rollupUtils.getAccountHash(
        account.ID,
        account.balance,
        account.nonce,
        account.tokenType,
        account.burn,
        account.lastBurn
    );
    return result;
}

export async function createLeaf(accountAlias: any) {
    const account: Account = {
        ID: accountAlias.AccID,
        balance: accountAlias.Amount,
        tokenType: accountAlias.TokenType,
        nonce: accountAlias.nonce,
        burn: 0,
        lastBurn: 0
    };
    return await CreateAccountLeaf(account);
}

// returns parent node hash given child node hashes
// are structured in a way that the leaf are at index 0 and index increases layer by layer to root
// for depth =2
// defaultHashes[0] = leaves
// defaultHashes[depth-1] = root
export function defaultHashes(depth: number) {
    const zeroValue = 0;
    const hashes = [];
    hashes[0] = getZeroHash(zeroValue);
    for (let i = 1; i < depth; i++) {
        hashes[i] = getParentLeaf(hashes[i - 1], hashes[i - 1]);
    }

    return hashes;
}

export function getZeroHash(zeroValue: any) {
    const abiCoder = ethers.utils.defaultAbiCoder;
    return ethers.utils.keccak256(abiCoder.encode(["uint256"], [zeroValue]));
}

export async function getMerkleRootFromLeaves(
    dataLeaves: string[],
    maxDepth: number
) {
    let nodes: string[] = dataLeaves.slice();
    const defaultHashesForLeaves: string[] = defaultHashes(maxDepth);
    let odd = nodes.length & 1;
    let n = (nodes.length + 1) >> 1;
    let level = 0;
    while (true) {
        let i = 0;
        for (; i < n - odd; i++) {
            let j = i << 1;
            nodes[i] = getParentLeaf(nodes[j], nodes[j + 1]);
        }
        if (odd == 1) {
            nodes[i] = getParentLeaf(
                nodes[i << 1],
                defaultHashesForLeaves[level]
            );
        }
        if (n == 1) {
            break;
        }
        odd = n & 1;
        n = (n + 1) >> 1;
        level += 1;
    }
    return nodes[0];
}

export async function getTokenRegistry() {
    return TokenRegistry.deployed();
}

export function sign(signBytes: string, wallet: Wallet) {
    const h = ethUtils.toBuffer(signBytes);
    const signature = ethUtils.ecsign(h, wallet.getPrivateKey());
    return ethUtils.toRpcSig(signature.v, signature.r, signature.s);
}

export async function signTx(tx: Transaction, wallet: Wallet) {
    const RollupUtilsInstance = await RollupUtils.deployed();
    const dataToSign = await RollupUtilsInstance.getTxSignBytes(
        tx.txType,
        tx.fromIndex,
        tx.toIndex,
        tx.nonce,
        tx.amount
    );
    return sign(dataToSign, wallet);
}

export async function TxToBytes(tx: Transaction) {
    const RollupUtilsInstance = await RollupUtils.deployed();
    const txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
        tx.txType,
        tx.fromIndex,
        tx.toIndex,
        tx.tokenType,
        tx.nonce,
        tx.amount
    );
    return txBytes;
}

export async function compressAndSubmitBatch(tx: Transaction, newRoot: string) {
    const RollupUtilsInstance = await RollupUtils.deployed();
    const txBytes = await TxToBytes(tx);
    const compressedTxs = await RollupUtilsInstance.CompressTransferFromEncoded(
        txBytes,
        tx.signature
    );
    await submitBatch(compressedTxs, newRoot, Usage.Transfer);
}
export async function submitBatch(
    compressedTxs: string,
    newRoot: string,
    usage: Usage
) {
    const rollupCoreInstance = await RollupCore.deployed();
    const govInstance = await Governance.deployed();
    const stakeAmount = (await govInstance.STAKE_AMOUNT()).toString();

    await rollupCoreInstance.submitBatch(
        [compressedTxs],
        [newRoot],
        usage,
        [[]],
        {
            value: stakeAmount
        }
    );
}

export async function registerToken(wallet: Wallet) {
    const testTokenInstance = await TestToken.deployed();
    const tokenRegistryInstance = await TokenRegistry.deployed();
    const depositManagerInstance = await DepositManager.deployed();
    await tokenRegistryInstance.requestTokenRegistration(
        testTokenInstance.address,
        { from: wallet.getAddressString() }
    );
    await tokenRegistryInstance.finaliseTokenRegistration(
        testTokenInstance.address,
        { from: wallet.getAddressString() }
    );
    await testTokenInstance.approve(
        depositManagerInstance.address,
        ethers.utils.parseEther("1").toString(),
        { from: wallet.getAddressString() }
    );
    return testTokenInstance;
}

export async function AccountFromBytes(accountBytes: string): Promise<Account> {
    const RollupUtilsInstance = await RollupUtils.deployed();
    const result = await RollupUtilsInstance.AccountFromBytes(accountBytes);
    const account: Account = {
        ID: result[0].toNumber(),
        balance: result[1].toNumber(),
        nonce: result[2].toNumber(),
        tokenType: result[3].toNumber(),
        burn: result[4].toNumber(),
        lastBurn: result[5].toNumber()
    };
    return account;
}

export async function getBatchId() {
    const rollupCoreInstance = await RollupCore.deployed();
    const batchLength = await rollupCoreInstance.numOfBatchesSubmitted();
    return Number(batchLength) - 1;
}
