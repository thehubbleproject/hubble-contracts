import { ethers } from "ethers";
import * as ethUtils from "ethereumjs-util";
import { Account, Transaction } from "./interfaces";
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const ParamManager = artifacts.require("ParamManager");
const nameRegistry = artifacts.require("NameRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const RollupUtils = artifacts.require("RollupUtils");
const Transfer = artifacts.require("Transfer");
const RollupCore = artifacts.require("Rollup");
const DepositManager = artifacts.require("DepositManager");
const TestToken = artifacts.require("TestToken");

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

export async function BytesFromTx(
  from: number,
  to: number,
  token: number,
  amount: number,
  type: number,
  nonce: number
) {
  var rollupUtils = await RollupUtils.deployed();
  var tx = {
    fromIndex: from,
    toIndex: to,
    tokenType: token,
    nonce: nonce,
    txType: type,
    amount: amount,
    signature: "",
  };
  var result = await rollupUtils.BytesFromTx(tx);
  return result;
}

export async function HashFromTx(
  from: number,
  to: number,
  token: number,
  amount: number,
  type: number,
  nonce: number
) {
  var data = await BytesFromTx(from, to, token, amount, type, nonce);
  return Hash(data);
}

// returns parent node hash given child node hashes
// are structured in a way that the leaf are at index 0 and index increases layer by layer to root
// for depth =2
// defaultHashes[0] = leaves
// defaultHashes[depth-1] = root
export async function defaultHashes(depth: number) {
  const zeroValue = 0;
  const hashes = [];
  hashes[0] = getZeroHash(zeroValue);
  for (let i = 1; i < depth; i++) {
    hashes[i] = getParentLeaf(
      hashes[i - 1],
      hashes[i - 1]
    );
  }

  return hashes;
}

export function getZeroHash(zeroValue: any) {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return ethers.utils.keccak256(abiCoder.encode(["uint256"], [zeroValue]));
}

export async function getMerkleTreeUtils() {
  // get deployed name registry instance
  var nameRegistryInstance = await nameRegistry.deployed();

  // get deployed parama manager instance
  var paramManager = await ParamManager.deployed();

  // get accounts tree key
  var merkleTreeUtilKey = await paramManager.MERKLE_UTILS();

  var merkleTreeUtilsAddr = await nameRegistryInstance.getContractDetails(
    merkleTreeUtilKey
  );
  return MerkleTreeUtils.at(merkleTreeUtilsAddr);
}

export async function getRollupUtils() {
  var rollupUtils: any = await rollupUtils.deployed();
  return rollupUtils;
}

export async function getMerkleRoot(dataLeaves: any, maxDepth: any) {
  var nextLevelLength = dataLeaves.length;
  var currentLevel = 0;
  var nodes: any = dataLeaves.slice();
  var defaultHashesForLeaves: any = defaultHashes(maxDepth);
  // create a merkle root to see if this is valid
  while (nextLevelLength > 1) {
    currentLevel += 1;

    // Calculate the nodes for the currentLevel
    for (var i = 0; i < nextLevelLength / 2; i++) {
      nodes[i] = getParentLeaf(nodes[i * 2], nodes[i * 2 + 1]);
    }
    nextLevelLength = nextLevelLength / 2;
    // Check if we will need to add an extra node
    if (nextLevelLength % 2 == 1 && nextLevelLength != 1) {
      nodes[nextLevelLength] = defaultHashesForLeaves[currentLevel];
      nextLevelLength += 1;
    }
  }
  return nodes[0];
}

export async function genMerkleRootFromSiblings(
  siblings: any,
  path: string,
  leaf: string
) {
  var computedNode: any = leaf;
  var splitPath = path.split("");
  for (var i = 0; i < siblings.length; i++) {
    var sibling = siblings[i];
    if (splitPath[splitPath.length - i - 1] == "0") {
      computedNode = getParentLeaf(computedNode, sibling);
    } else {
      computedNode = getParentLeaf(sibling, computedNode);
    }
  }
  return computedNode;
}

export async function getTokenRegistry() {
  return TokenRegistry.deployed();
}

export async function compressTx(
  from: number,
  to: number,
  nonce: number,
  amount: number,
  token: number,
  sig: any
) {
  var rollupUtils = await RollupUtils.deployed();
  var tx = {
    fromIndex: from,
    toIndex: to,
    tokenType: token,
    nonce: nonce,
    txType: 1,
    amount: amount,
    signature: sig,
  };

  // TODO find out why this fails
  // await rollupUtils.CompressTx(tx);

  var message = await TxToBytes(tx);
  var result = await rollupUtils.CompressTxWithMessage(message, tx.signature);
  return result;
}

export function sign(signBytes: string, wallet: any) {
  const h = ethUtils.toBuffer(signBytes);
  const signature = ethUtils.ecsign(h, wallet.getPrivateKey());
  return ethUtils.toRpcSig(signature.v, signature.r, signature.s);
}

export async function signTx(tx: Transaction, wallet: any) {
  const RollupUtilsInstance = await RollupUtils.deployed();
  const dataToSign = await RollupUtilsInstance.getTxSignBytes(
    tx.fromIndex,
    tx.toIndex,
    tx.tokenType,
    tx.txType,
    tx.nonce,
    tx.amount
  );
  return sign(dataToSign, wallet);
}

export enum Usage {
  Genesis, Transfer, CreateAccount, Airdrop, BurnConsent, BurnExecution
}

export async function TxToBytes(tx: Transaction) {
  const RollupUtilsInstance = await RollupUtils.deployed();
  var txBytes = await RollupUtilsInstance.BytesFromTxDeconstructed(
    tx.fromIndex,
    tx.toIndex,
    tx.tokenType,
    tx.nonce,
    tx.txType,
    tx.amount
  );
  return txBytes;
}

export async function falseProcessTx(_tx: any, accountProofs: any) {
  const transferInstance = await Transfer.deployed();
  const _to_merkle_proof = accountProofs.to;
  const new_to_txApply = await transferInstance.ApplyTx(
    _to_merkle_proof,
    _tx
  );
  return new_to_txApply.newRoot;
}

export async function compressAndSubmitBatch(tx: Transaction, newRoot: string) {
  const rollupCoreInstance = await RollupCore.deployed();
  const compressedTx = await compressTx(
    tx.fromIndex,
    tx.toIndex,
    tx.nonce,
    tx.amount,
    tx.tokenType,
    tx.signature
  );

  const compressedTxs = [compressedTx];

  // submit batch for that transactions
  await rollupCoreInstance.submitBatch(
    compressedTxs,
    newRoot,
    Usage.Transfer,
    { value: ethers.utils.parseEther("32").toString() }
  );
}


export async function registerToken(wallet: any) {
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
    ethers.utils.parseEther("1"),
    { from: wallet.getAddressString() }
  );
  return testTokenInstance
}
