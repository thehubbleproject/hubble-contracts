import { ethers, ContractFactory } from "ethers";
import { readArtifact } from "@nomiclabs/buidler/plugins";
import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";

export function randomHex(numBytes: number) {
    return ethers.utils.randomBytes(numBytes).toString();
}

export function randomNum(numBytes: number): number {
    const bytes = ethers.utils.randomBytes(numBytes);
    return ethers.BigNumber.from(bytes).toNumber();
}

// with zeros prepended to length bytes.
export function paddedHex(num: number, length: number): string {
    return ethers.utils.hexZeroPad(ethers.utils.hexlify(num), length);
}

export function parseEvents(receipt: any): { [key: string]: any[] } {
    const obj: { [key: string]: any[] } = {};
    receipt.events.forEach((event: any) => {
        obj[event.event] = event.args;
    });
    return obj;
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

function linkSolidity5(
    bytecode: string,
    libraryName: string,
    libraryAddress: string
) {
    const address = libraryAddress.replace("0x", "");
    const encodedLibraryName = ethers.utils
        .solidityKeccak256(["string"], [libraryName])
        .slice(2, 36);
    const pattern = new RegExp(`_+\\$${encodedLibraryName}\\$_+`, "g");
    if (!pattern.exec(bytecode)) {
        throw new Error(`Can't link '${libraryName}'.`);
    }
    return bytecode.replace(pattern, address);
}

export interface Library {
    // Should be a path like "contracts/libs/RollupUtils.sol:RollupUtils"
    name: string;
    // The address of a deployed instance of the library
    address: string;
}

export async function getLinkedFactory(
    bre: BuidlerRuntimeEnvironment,
    name: string,
    libraries: Library[]
) {
    const artifact = await readArtifact(bre.config.paths.artifacts, name);

    let linkedBytecode = artifact.bytecode;
    for (const library of libraries) {
        linkedBytecode = linkSolidity5(
            linkedBytecode,
            library.name,
            library.address
        );
    }
    const signers = await bre.ethers.getSigners();
    return new ContractFactory(artifact.abi, linkedBytecode, signers[0]);
}
