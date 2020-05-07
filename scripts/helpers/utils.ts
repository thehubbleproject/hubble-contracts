import {ethers} from "ethers";
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const ParamManager = artifacts.require("ParamManager");
const nameRegistry = artifacts.require("NameRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
// returns parent node hash given child node hashes
export function getParentLeaf(left: string, right: string) {
  var abiCoder = ethers.utils.defaultAbiCoder;
  var hash = ethers.utils.keccak256(
    abiCoder.encode(["bytes32", "bytes32"], [left, right])
  );
  return hash;
}

export function Hash(data: string) {
  // var dataBytes = ethers.utils.toUtf8Bytes(data);
  return ethers.utils.keccak256(data);
}

export function StringToBytes32(data: string) {
  return ethers.utils.formatBytes32String(data);
}

export function BytesFromAccountData(
  ID: number,
  balance: number,
  nonce: number,
  token: number
) {
  var abiCoder = ethers.utils.defaultAbiCoder;

  return abiCoder.encode(
    ["uint256", "uint256", "uint256", "uint256"],
    [ID, balance, nonce, token]
  );
}

export function CreateAccountLeaf(
  ID: number,
  balance: number,
  nonce: number,
  token: number
) {
  var data = BytesFromAccountData(ID, balance, nonce, token);
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

export async function getMerkleRootWithCoordinatorAccount(maxSize: any) {
  // coordinator account
  var coordinator = CreateAccountLeaf(0, 0, 0, 0);
  var dataLeaves = [];
  dataLeaves[0] = coordinator;
  console.log("hered");
  // create empty leaves
  for (var i = 1; i < maxSize; i++) {
    dataLeaves[i] = getZeroHash(0);
  }

  var merkleTree = getMerkleTreeUtils();
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
      console.log("root", nodes[i]);
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
  // get deployed name registry instance
  var nameRegistryInstance = await nameRegistry.deployed();

  // get deployed parama manager instance
  var paramManager = await ParamManager.deployed();

  // get accounts tree key
  var tokenRegistryKey = await paramManager.TOKEN_REGISTRY();

  var tokenRegistryAddress = await nameRegistryInstance.getContractDetails(
    tokenRegistryKey
  );
  return TokenRegistry.at(tokenRegistryAddress);
}
