import { BigNumber, BigNumberish, BytesLike } from "ethers";
import { formatUnits, hexZeroPad, parseUnits } from "ethers/lib/utils";
import { EncodingError } from "./exceptions";
import { ONE, randHex } from "./utils";

export interface Decimals {
    l1Decimals: number;
    l2Decimals: number;
    l2Unit: BigNumber;
}

export class ERC20ValueFactory {
    public readonly decimals: Decimals;

    constructor(public readonly l1Decimals: number = 18) {
        // l2Decimals and l2Unit are determined by the rules of TokenRegistry
        const l2Decimals = l1Decimals >= 9 ? l1Decimals - 9 : l1Decimals;
        const l2Unit = l1Decimals >= 9 ? BigNumber.from(1000000000) : ONE;
        this.decimals = { l1Decimals, l2Decimals, l2Unit };
    }
    /**
     * @param humanValue could be a fractional number but is string. Like '1.23'
     */
    fromHumanValue(humanValue: string) {
        const l1Value = parseUnits(humanValue, this.l1Decimals);
        return new ERC20Value(this.decimals, l1Value);
    }
    /**
     * @param uint256Value is an integer like '1230000000000000000'
     */
    fromL1Value(uint256Value: BigNumberish) {
        const l1Value = BigNumber.from(uint256Value);
        return new ERC20Value(this.decimals, l1Value);
    }
    /**
     * @param uint256Value is an integer like '1230000000000000000'
     */
    fromL2Value(uint256Value: BigNumberish) {
        const l1Value = BigNumber.from(uint256Value).mul(this.decimals.l2Unit);
        return new ERC20Value(this.decimals, l1Value);
    }
}

export class ERC20Value {
    constructor(
        public readonly decimals: Decimals,
        public readonly l1Value: BigNumber
    ) {}
    get l2Value() {
        return this.l1Value.div(this.decimals.l2Unit);
    }
    get humanValue() {
        return formatUnits(this.l1Value, this.decimals.l1Decimals);
    }
}

export const USDT = new ERC20ValueFactory(6);
export const CommonToken = new ERC20ValueFactory(18);

export class Float {
    private mantissaMax: BigNumber;
    private exponentMax: number;
    private exponentMask: BigNumber;
    public bytesLength: number;
    constructor(
        public readonly exponentBits: number,
        public readonly mantissaBits: number
    ) {
        this.mantissaMax = BigNumber.from(2 ** mantissaBits - 1);
        this.exponentMax = 2 ** exponentBits - 1;
        this.exponentMask = BigNumber.from(this.exponentMax << mantissaBits);
        this.bytesLength = (mantissaBits + exponentBits) / 8;
    }

    public rand(): string {
        return randHex(this.bytesLength);
    }

    public randInt(): BigNumber {
        return this.decompress(this.rand());
    }

    /**
     * Round the input down to a compressible number.
     */
    public round(input: BigNumber): BigNumber {
        let mantissa = input;
        for (let exponent = 0; exponent < this.exponentMax; exponent++) {
            if (mantissa.lte(this.mantissaMax))
                return mantissa.mul(BigNumber.from(10).pow(exponent));
            mantissa = mantissa.div(10);
        }
        throw new EncodingError(`Can't cast input ${input.toString()}`);
    }

    public compress(input: BigNumberish): string {
        let mantissa = BigNumber.from(input.toString());
        let exponent = 0;
        for (; exponent < this.exponentMax; exponent++) {
            if (mantissa.isZero() || !mantissa.mod(10).isZero()) break;
            mantissa = mantissa.div(10);
        }
        if (mantissa.gt(this.mantissaMax))
            throw new EncodingError(
                `Cannot compress ${input}, expect mantissa ${mantissa} <= ${this.mantissaMax}`
            );

        const hex = BigNumber.from(exponent)
            .shl(this.mantissaBits)
            .add(mantissa)
            .toHexString();
        return hexZeroPad(hex, this.bytesLength);
    }
    public decompress(input: BytesLike): BigNumber {
        const mantissa = this.mantissaMax.and(input);
        const exponent = this.exponentMask.and(input).shr(this.mantissaBits);

        return mantissa.mul(BigNumber.from(10).pow(exponent));
    }
}

export const float16 = new Float(4, 12);
