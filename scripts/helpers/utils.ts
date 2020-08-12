import { ethers } from "ethers";
import * as ethUtils from "ethereumjs-util";
import {
    Account,
    Transaction,
    Usage,
    Wallet,
    AccountMerkleProof,
    PDAMerkleProof,
    ProcessTxResult,
    AccountProofs,
    ApplyTxResult,
    ApplyTxOffchainResult,
    GovConstants
} from "./interfaces";
import { StateStore } from "./store";
const TokenRegistry = artifacts.require("TokenRegistry");
const RollupUtils = artifacts.require("RollupUtils");
const RollupCore = artifacts.require("Rollup");
const DepositManager = artifacts.require("DepositManager");
const TestToken = artifacts.require("TestToken");
const RollupReddit = artifacts.require("RollupReddit");
const IMT = artifacts.require("IncrementalTree");
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
    await rollupCoreInstance.submitBatch(compressedTxs, newRoot, usage, {
        value: stakeAmount
    });
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

export async function disputeBatch(
    compressedTxs: string,
    accountProofs: AccountProofs[],
    pdaProof: PDAMerkleProof[],
    _batchId?: number
) {
    const rollupCoreInstance = await RollupCore.deployed();
    const batchId = _batchId ? _batchId : await getBatchId();
    const batchProofs = {
        accountProofs,
        pdaProof
    };
    await rollupCoreInstance.disputeBatch(batchId, compressedTxs, batchProofs);
}

export async function disputeTransferBatch(
    transactions: Transaction[],
    accountProofs: AccountProofs[],
    pdaProof: PDAMerkleProof[],
    _batchId?: number
) {
    const rollupUtilsInstance = await RollupUtils.deployed();
    const encodedTxs: string[] = [];
    for (const tx of transactions) {
        encodedTxs.push(await TxToBytes(tx));
    }
    const sigs = transactions.map(tx => tx.signature);
    const compressedTxs = await rollupUtilsInstance.CompressManyTransferFromEncoded(
        encodedTxs,
        sigs
    );
    await disputeBatch(compressedTxs, accountProofs, pdaProof, _batchId);
}

export async function ApplyTransferTx(
    encodedTx: string,
    merkleProof: AccountMerkleProof
): Promise<ApplyTxResult> {
    const rollupRedditInstance = await RollupReddit.deployed();
    const result = await rollupRedditInstance.ApplyTransferTx(
        merkleProof,
        encodedTx
    );
    const newState = await AccountFromBytes(result[0]);
    const newStateRoot = result[1];
    return {
        newState,
        newStateRoot
    };
}

export async function processTransferTx(
    tx: Transaction,
    alicePDAProof: PDAMerkleProof,
    accountProofs: AccountProofs
): Promise<ProcessTxResult> {
    const rollupCoreInstance = await RollupCore.deployed();
    const rollupRedditInstance = await RollupReddit.deployed();
    const IMTInstance = await IMT.deployed();

    const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    const accountRoot = await IMTInstance.getTreeRoot();
    const txByte = await TxToBytes(tx);

    const result = await rollupRedditInstance.processTransferTx(
        currentRoot,
        accountRoot,
        tx.signature,
        txByte,
        alicePDAProof,
        accountProofs
    );

    return {
        newStateRoot: result[0],
        error: Number(result[3])
    };
}

// Side effects on stateStore! It updates the state root in stateStore
export async function processTransferTxOffchain(
    stateStore: StateStore,
    tx: Transaction
): Promise<ApplyTxOffchainResult> {
    const txByte = await TxToBytes(tx);
    const fromAccountMP = await stateStore.getAccountMerkleProof(tx.fromIndex);
    const fromResult = await ApplyTransferTx(txByte, fromAccountMP);
    await stateStore.update(tx.fromIndex, fromResult.newState);

    const toAccountMP = await stateStore.getAccountMerkleProof(tx.toIndex);
    const toResult = await ApplyTransferTx(txByte, toAccountMP);
    await stateStore.update(tx.toIndex, toResult.newState);
    return {
        accountProofs: {
            from: fromAccountMP,
            to: toAccountMP
        },
        newStateRoot: toResult.newStateRoot
    };
}

export async function getGovConstants(): Promise<GovConstants> {
    const govInstance = await Governance.deployed();
    const MAX_DEPTH = Number(await govInstance.MAX_DEPTH());
    const MAX_TXS_PER_BATCH = Number(await govInstance.MAX_TXS_PER_BATCH());
    const STAKE_AMOUNT = (await govInstance.STAKE_AMOUNT()).toString();
    return {
        MAX_DEPTH,
        STAKE_AMOUNT,
        MAX_TXS_PER_BATCH
    };
}

export async function logEstimate(compressedTxs: string, usage: Usage) {
    const rollupCoreInstance = await RollupCore.deployed();
    const govConstants = await getGovConstants();
    const balanceRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    const gasEstimation = await rollupCoreInstance.submitBatch.estimateGas(
        compressedTxs,
        balanceRoot,
        usage,
        {
            value: govConstants.STAKE_AMOUNT
        }
    );
    console.log("submitBatch for", Usage[usage], "use", gasEstimation, "gas");
    console.log("compressedTxs size:", (compressedTxs.length - 2) / 2, "bytes");
}
