"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Hasher = void 0;
const ethers_1 = require("ethers");
const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
class Hasher {
    constructor(leafType = "uint256", zero = ZERO) {
        this.leafType = leafType;
        this.zero = zero;
    }
    static new(leafType = "uint256", zero = ZERO) {
        return new Hasher(leafType, zero);
    }
    toLeaf(data) {
        return ethers_1.ethers.utils.solidityKeccak256([this.leafType], [data]);
    }
    hash(x0) {
        return ethers_1.ethers.utils.solidityKeccak256(["uint256"], [x0]);
    }
    hash2(x0, x1) {
        return ethers_1.ethers.utils.solidityKeccak256(["uint256", "uint256"], [x0, x1]);
    }
    zeros(depth) {
        const N = depth + 1;
        const zeros = Array(N).fill(this.zero);
        for (let i = 1; i < N; i++) {
            zeros[N - 1 - i] = this.hash2(zeros[N - i], zeros[N - i]);
        }
        return zeros;
    }
}
exports.Hasher = Hasher;
//# sourceMappingURL=hasher.js.map