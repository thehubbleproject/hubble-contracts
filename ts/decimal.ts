import { BigNumber, BigNumberish, BytesLike, ethers } from "ethers";
import { EncodingError } from "./exceptions";

export class DecimalCodec {
    private mantissaMask: BigNumber;
    private exponentMax: number;
    private exponentMask: BigNumber;
    public bytesLength: number;

    constructor(
        public readonly exponentBits: number,
        public readonly mantissaBits: number,
        public readonly place: number
    ) {
        this.mantissaMask = BigNumber.from(2 ** mantissaBits - 1);
        this.exponentMax = 2 ** exponentBits - 1;
        this.exponentMask = BigNumber.from(this.exponentMax << mantissaBits);
        this.bytesLength = (mantissaBits + exponentBits) / 8;
    }
    public encode(input: number) {
        const integer = Math.floor(input * 10 ** this.place);
        return this.encodeInt(integer);
    }
    public decode(input: BytesLike): number {
        const integer = this.decodeInt(input);
        return integer.toNumber() / 10 ** this.place;
    }

    public encodeInt(input: BigNumberish): string {
        let exponent = 0;
        let mantissa = BigNumber.from(input);
        for (let i = 0; i < this.exponentMax; i++) {
            if (!mantissa.isZero() && mantissa.mod(10).isZero()) {
                mantissa = mantissa.div(10);
                exponent += 1;
            } else {
                break;
            }
        }
        if (mantissa.gt(this.mantissaMask)) {
            throw new EncodingError(
                `Can not encode input ${input}, mantissa ${mantissa} should not be larger than ${this.mantissaMask}`
            );
        }
        return BigNumber.from(exponent)
            .shl(this.mantissaBits)
            .add(mantissa)
            .toHexString()
            .padStart(this.bytesLength);
    }
    public decodeInt(input: BytesLike): BigNumber {
        const mantissa = this.mantissaMask.and(input);
        const exponent = this.exponentMask.and(input).shr(this.mantissaBits);

        return mantissa.mul(BigNumber.from(10).pow(exponent));
    }
}
