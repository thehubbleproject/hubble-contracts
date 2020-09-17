import { assert } from "chai";
import { DecimalCodec } from "../ts/decimal";
import { EncodingError } from "../ts/exceptions";

describe("Decimal", () => {
    const USDT = new DecimalCodec(4, 12, 6);

    it("Get's some property right", () => {
        assert.equal(USDT.bytesLength, 2);
    });

    it("Compresses and decompresses values", () => {
        const cases: number[] = [0, 1, 10000, 12.13, 0.1234, 18690000000];

        for (const value of cases) {
            assert.equal(
                USDT.decode(USDT.encode(value)),
                value,
                `Mismatch Encode and decode of ${value}`
            );
        }
    });
    it("Compresses and decompresses random values", () => {
        let value: number;
        for (let i = 0; i <= 20; i++) {
            value = USDT.randNum();
            assert.equal(
                USDT.decode(USDT.encode(value)),
                value,
                `Mismatch Encode and decode of ${value}`
            );
        }
    });

    it("throws for bad cases", () => {
        const failingCases: number[] = [0.12345, 56789, 123.123];
        for (const value of failingCases) {
            assert.throws(() => {
                USDT.encode(value);
            }, EncodingError);
        }
    });
});
