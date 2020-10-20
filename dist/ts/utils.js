"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.merklise = exports.defaultHashes = exports.getParentLeaf = exports.mineBlocks = exports.randomLeaves = exports.randomNum = exports.randFs = exports.to32Hex = exports.sum = exports.randHex = exports.TWO = exports.ONE = exports.ZERO = exports.FIELD_ORDER = void 0;
const ethers_1 = require("ethers");
const ethers_2 = require("ethers");
const utils_1 = require("ethers/lib/utils");
exports.FIELD_ORDER = ethers_2.BigNumber.from("0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47");
exports.ZERO = ethers_2.BigNumber.from("0");
exports.ONE = ethers_2.BigNumber.from("1");
exports.TWO = ethers_2.BigNumber.from("2");
function randHex(n) {
    return utils_1.hexlify(utils_1.randomBytes(n));
}
exports.randHex = randHex;
function sum(xs) {
    return xs.reduce((a, b) => a.add(b));
}
exports.sum = sum;
function to32Hex(n) {
    return utils_1.hexZeroPad(n.toHexString(), 32);
}
exports.to32Hex = to32Hex;
function randFs() {
    const r = ethers_2.BigNumber.from(utils_1.randomBytes(32));
    return r.mod(exports.FIELD_ORDER);
}
exports.randFs = randFs;
function randomNum(numBytes) {
    const bytes = utils_1.randomBytes(numBytes);
    return ethers_2.BigNumber.from(bytes).toNumber();
}
exports.randomNum = randomNum;
function randomLeaves(num) {
    const leaves = [];
    for (let i = 0; i < num; i++) {
        leaves.push(randHex(32));
    }
    return leaves;
}
exports.randomLeaves = randomLeaves;
async function mineBlocks(provider, numOfBlocks) {
    for (let i = 0; i < numOfBlocks; i++) {
        await provider.send("evm_mine", []);
    }
}
exports.mineBlocks = mineBlocks;
function getParentLeaf(left, right) {
    return ethers_1.ethers.utils.solidityKeccak256(["bytes32", "bytes32"], [left, right]);
}
exports.getParentLeaf = getParentLeaf;
function defaultHashes(depth) {
    const hashes = [];
    hashes[0] = utils_1.keccak256(ethers_1.constants.HashZero);
    for (let i = 1; i < depth; i++) {
        hashes[i] = getParentLeaf(hashes[i - 1], hashes[i - 1]);
    }
    return hashes;
}
exports.defaultHashes = defaultHashes;
async function merklise(dataLeaves, maxDepth) {
    let nodes = dataLeaves.slice();
    const defaultHashesForLeaves = defaultHashes(maxDepth);
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
            nodes[i] = getParentLeaf(nodes[i << 1], defaultHashesForLeaves[level]);
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
exports.merklise = merklise;
//# sourceMappingURL=utils.js.map