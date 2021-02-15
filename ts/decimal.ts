import { BigNumber, BigNumberish, BytesLike, ethers } from "ethers";
import { formatUnits, hexZeroPad, parseUnits } from "ethers/lib/utils";
import { EncodingError } from "./exceptions";
import { randHex } from "./utils";

export class ERC20 {
    constructor(public decimals: number = 18) {}
    /**
     * Parse the human readable value like "1.23" to the ERC20 integer amount.
     * @param humanValue could be a fractional number but is string. Like '1.23'
     * @returns the ERC20 integer amount. Like '1230000000000000000' but in BigNumber
     */
    parse(humanValue: string) {
        return parseUnits(humanValue, this.decimals);
    }
    /**
     * Format the ERC20 integer amount to human readable value.
     * @param uint256Value is an integer like '1230000000000000000'
     * @returns Could be a fractional number but in string. Like '1.23'
     */
    format(uint256Value: BigNumberish) {
        return formatUnits(uint256Value, this.decimals);
    }
}

export const USDT = new ERC20(6);

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
