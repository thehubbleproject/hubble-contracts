import {ethers} from "ethers";

// returns parent node hash given child node hashes
export function getParent(left: string, right: string) {
  var abiCoder = ethers.utils.defaultAbiCoder;
  var hash = ethers.utils.keccak256(
    abiCoder.encode(["bytes32", "bytes32"], [Hash(left), Hash(right)])
  );
  return hash;
}

export function Hash(data: string) {
  var dataBytes = ethers.utils.toUtf8Bytes(data);
  return ethers.utils.keccak256(dataBytes);
}

export function StringToBytes32(data: string) {
  return ethers.utils.formatBytes32String(data);
}
