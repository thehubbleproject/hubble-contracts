import {ethers} from "ethers";
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const ParamManager = artifacts.require("ParamManager");
const nameRegistry = artifacts.require("NameRegistry");

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
