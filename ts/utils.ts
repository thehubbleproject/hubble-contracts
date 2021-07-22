import { ethers, BigNumber } from "ethers";
import {
    randomBytes,
    hexlify,
    hexZeroPad,
    parseEther,
    BytesLike,
    solidityKeccak256,
    getAddress
} from "ethers/lib/utils";
import { Vacant, Wei } from "./interfaces";
import { Rollup } from "../types/ethers-contracts/Rollup";

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
    if (xs.length == 0) return ZERO;
    return xs.reduce((a, b) => a.add(b));
}

export function sumNumber(xs: number[]): number {
    if (xs.length == 0) return 0;
    return xs.reduce((a, b) => a + b);
}

export function to32Hex(n: BigNumber): string {
    return hexZeroPad(n.toHexString(), 32);
}

export function hexToUint8Array(h: string): Uint8Array {
    return Uint8Array.from(Buffer.from(h.slice(2), "hex"));
}

export function toWei(ether: string): Wei {
    return parseEther(ether).toString();
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

/**
 * Generates a random address. Usefully for testing when
 * you don't need a valid address or contract.
 *
 * @returns Randomly generated address.
 */
export function randomAddress(): string {
    return getAddress(randHex(20));
}

// Simulate the tree depth of calling contracts/libs/MerkleTree.sol::MerkleTree.merklize
// Make the depth as shallow as possible
// the length 1 is a special case that the formula doesn't work
export function minTreeDepth(leavesLength: number) {
    return leavesLength == 1 ? 1 : Math.ceil(Math.log2(leavesLength));
}

export async function mineBlocks(
    provider: ethers.providers.JsonRpcProvider,
    numOfBlocks: number
) {
    for (let i = 0; i < numOfBlocks; i++) {
        await provider.send("evm_mine", []);
    }
}

export async function getBatchID(rollup: Rollup): Promise<number> {
    return Number(await rollup.nextBatchID()) - 1;
}

export async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function computeRoot(
    leafInput: BytesLike,
    path: number,
    witness: BytesLike[]
) {
    let leaf = leafInput;
    for (let i = 0; i < witness.length; i++) {
        if (((path >> i) & 1) == 0) {
            leaf = solidityKeccak256(
                ["bytes32", "bytes32"],
                [leaf, witness[i]]
            );
        } else {
            leaf = solidityKeccak256(
                ["bytes32", "bytes32"],
                [witness[i], leaf]
            );
        }
    }
    return leaf;
}

export function prettyHex(hex: string): string {
    const hexNo0x = hex.slice(0, 2) == "0x" ? hex.slice(2) : hex;
    return `${hexNo0x.slice(0, 6)}…${hexNo0x.slice(-6)}`;
}

export function prettyHexArray(hexArr: string[]): string {
    if (hexArr.length == 1) {
        return `[${prettyHex(hexArr[0])}]`;
    }
    if (hexArr.length == 2) {
        return `[${prettyHex(hexArr[0])}, ${prettyHex(hexArr[1])}]`;
    }
    if (hexArr.length > 2) {
        return `[${prettyHex(hexArr[0])}, ..., ${prettyHex(
            hexArr[hexArr.length - 1]
        )}]`;
    }
    // arr.length === 0
    return "[]";
}

export function prettyVacant({ pathAtDepth, witness }: Vacant): string {
    const prettyWitness = prettyHexArray(witness);
    return `<Vacant  pathAtDepth ${pathAtDepth} witness ${prettyWitness}>`;
}
