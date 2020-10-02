import { ethers } from "ethers";
import { BigNumber } from "ethers";
import { randomBytes, hexlify, hexZeroPad } from "ethers/lib/utils";

export const FIELD_ORDER = BigNumber.from(
    "0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47"
);

export const ZERO = BigNumber.from("0");
export const ONE = BigNumber.from("1");
export const TWO = BigNumber.from("2");

export function randHex(n: number): string {
    return hexlify(randomBytes(n));
}

export function sum(xs: BigNumber[]): BigNumber {
    return xs.reduce((a, b) => a.add(b));
}

export function to32Hex(n: BigNumber): string {
    return hexZeroPad(n.toHexString(), 32);
}

export function randFs(): BigNumber {
    const r = BigNumber.from(randomBytes(32));
    return r.mod(FIELD_ORDER);
}

export function randomNum(numBytes: number): number {
    const bytes = randomBytes(numBytes);
    return BigNumber.from(bytes).toNumber();
}

export function randomLeaves(num: number): string[] {
    const leaves = [];
    for (let i = 0; i < num; i++) {
        leaves.push(randHex(32));
    }
    return leaves;
}

export function getParentLeaf(left: string, right: string) {
    return ethers.utils.solidityKeccak256(
        ["bytes32", "bytes32"],
        [left, right]
    );
}

export function getZeroHash(zeroValue: any) {
    return ethers.utils.solidityKeccak256(["uint256"], [zeroValue]);
}

export function defaultHashes(depth: number) {
    const zeroValue = 0;
    const hashes = [];
    hashes[0] = getZeroHash(zeroValue);
    for (let i = 1; i < depth; i++) {
        hashes[i] = getParentLeaf(hashes[i - 1], hashes[i - 1]);
    }

    return hashes;
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
