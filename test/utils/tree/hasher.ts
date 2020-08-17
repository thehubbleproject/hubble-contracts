export type Node = string;

const ZERO =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

export class Hasher {
    static new(leafType = "uint256", zero = ZERO): Hasher {
        return new Hasher(leafType, zero);
    }

    constructor(private leafType = "uint256", private zero = ZERO) {}

    public toLeaf(data: string): string {
        return web3.utils.soliditySha3({ t: this.leafType, v: data })!;
    }

    public hash(x0: string): string {
        return web3.utils.soliditySha3({ t: "uint256", v: x0 })!;
    }

    public hash2(x0: string, x1: string): string {
        return web3.utils.soliditySha3(
            { t: "uint256", v: x0 },
            { t: "uint256", v: x1 }
        )!;
    }

    public zeros(depth: number): Array<Node> {
        const N = depth + 1;
        const zeros = Array(N).fill(this.zero);
        for (let i = 1; i < N; i++) {
            zeros[N - 1 - i] = this.hash2(zeros[N - i], zeros[N - i]);
        }
        return zeros;
    }
}
