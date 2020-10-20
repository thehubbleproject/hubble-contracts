"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDT = exports.DecimalCodec = void 0;
const ethers_1 = require("ethers");
const exceptions_1 = require("./exceptions");
const utils_1 = require("./utils");
class DecimalCodec {
    constructor(exponentBits, mantissaBits, place) {
        this.exponentBits = exponentBits;
        this.mantissaBits = mantissaBits;
        this.place = place;
        this.mantissaMax = ethers_1.BigNumber.from(2 ** mantissaBits - 1);
        this.exponentMax = 2 ** exponentBits - 1;
        this.exponentMask = ethers_1.BigNumber.from(this.exponentMax << mantissaBits);
        this.bytesLength = (mantissaBits + exponentBits) / 8;
    }
    rand() {
        return utils_1.randHex(this.bytesLength);
    }
    randInt() {
        return this.decodeInt(this.rand());
    }
    randNum() {
        return this.decode(this.rand());
    }
    /**
     * Given an arbitrary js number returns a js number that can be encoded.
     */
    cast(input) {
        if (input == 0) {
            return input;
        }
        const logMantissaMax = Math.log10(this.mantissaMax.toNumber());
        const logInput = Math.log10(input);
        const exponent = Math.floor(logMantissaMax - logInput);
        const mantissa = Math.floor(input * 10 ** exponent);
        return mantissa / 10 ** exponent;
    }
    /**
     * Given an arbitrary js number returns a integer that can be encoded
     */
    castInt(input) {
        const validNum = this.cast(input);
        return ethers_1.BigNumber.from(Math.round(validNum * 10 ** this.place));
    }
    encode(input) {
        // Use Math.round here to prevent the case
        // > 32.3 * 10 ** 6
        // 32299999.999999996
        const integer = Math.round(input * 10 ** this.place);
        return this.encodeInt(integer);
    }
    decode(input) {
        const integer = this.decodeInt(input);
        const tens = ethers_1.BigNumber.from(10).pow(this.place);
        if (integer.gte(Number.MAX_SAFE_INTEGER.toString())) {
            return integer.div(tens).toNumber();
        }
        else {
            return integer.toNumber() / tens.toNumber();
        }
    }
    encodeInt(input) {
        let exponent = 0;
        let mantissa = ethers_1.BigNumber.from(input.toString());
        for (let i = 0; i < this.exponentMax; i++) {
            if (!mantissa.isZero() && mantissa.mod(10).isZero()) {
                mantissa = mantissa.div(10);
                exponent += 1;
            }
            else {
                break;
            }
        }
        if (mantissa.gt(this.mantissaMax)) {
            throw new exceptions_1.EncodingError(`Can not encode input ${input}, mantissa ${mantissa} should not be larger than ${this.mantissaMax}`);
        }
        const hex = ethers_1.BigNumber.from(exponent)
            .shl(this.mantissaBits)
            .add(mantissa)
            .toHexString();
        return ethers_1.ethers.utils.hexZeroPad(hex, this.bytesLength);
    }
    decodeInt(input) {
        const mantissa = this.mantissaMax.and(input);
        const exponent = this.exponentMask.and(input).shr(this.mantissaBits);
        return mantissa.mul(ethers_1.BigNumber.from(10).pow(exponent));
    }
}
exports.DecimalCodec = DecimalCodec;
exports.USDT = new DecimalCodec(4, 12, 6);
//# sourceMappingURL=decimal.js.map