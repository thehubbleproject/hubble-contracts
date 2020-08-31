import { ethers } from "ethers";
import * as ethUtils from "ethereumjs-util";
import { Wallet } from "./interfaces";

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

export function sign(signBytes: string, wallet: Wallet) {
    const h = ethUtils.toBuffer(signBytes);
    const signature = ethUtils.ecsign(h, wallet.getPrivateKey());
    return ethUtils.toRpcSig(signature.v, signature.r, signature.s);
}
