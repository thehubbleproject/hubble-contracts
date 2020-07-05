import { ethers } from "ethers";
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const ParamManager = artifacts.require("ParamManager");
const nameRegistry = artifacts.require("NameRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const RollupUtils = artifacts.require("RollupUtils");
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

export async function BytesFromAccountData(
  ID: number,
  balance: number,
  nonce: number,
  token: number
) {
  var rollupUtils = await RollupUtils.deployed();
  var account = {
    ID: ID,
    tokenType: token,
    balance: balance,
    nonce: nonce,
  };
  return rollupUtils.BytesFromAccount(account);
}

export async function CreateAccountLeaf(
  ID: number,
  balance: number,
  nonce: number,
  token: number
) {
  var rollupUtils = await RollupUtils.deployed();
  var result = await rollupUtils.getAccountHash(ID, balance, nonce, token);
  return result;
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
  var zeroValue = 0;
  var defaultHashes = [];
  var abiCoder = ethers.utils.defaultAbiCoder;
  var zeroHash = await getZeroHash(zeroValue);
  defaultHashes[0] = zeroHash;

  for (let i = 1; i < depth; i++) {
    defaultHashes[i] = getParentLeaf(
      defaultHashes[i - 1],
      defaultHashes[i - 1]
    );
  }

  return defaultHashes;
}

export async function getZeroHash(zeroValue: any) {
  var abiCoder = ethers.utils.defaultAbiCoder;
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

  var message = await rollupUtils.BytesFromTxDeconstructed(
    tx.fromIndex,
    tx.toIndex,
    tx.tokenType,
    tx.nonce,
    tx.txType,
    tx.amount
  );
  var result = await rollupUtils.CompressTxWithMessage(message, tx.signature);
  return result;
}

export enum BatchType {
  Genesis, Transfer, Airdrop
}
