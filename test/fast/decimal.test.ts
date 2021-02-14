import { assert } from "chai";
import { float16, USDT } from "../../ts/decimal";

describe("Decimal", () => {
    it("Get's some property right", () => {
        assert.equal(float16.bytesLength, 2);
    });

    it("Rounding values", () => {
        const losslessCases: number[] = [
            0,
            1,
            10000,
            12.13,
            0.1234,
            18690000000
        ];
        for (const value of losslessCases) {
            const valueBN = USDT.parse(value.toString());
            assert.equal(
                float16.round(valueBN).toString(),
                valueBN.toString(),
                "Casted value should be the same in good cases"
            );
        }
        const lossyCases = [
            { input: 0.12345, expect: 0.1234 },
            { input: 56789, expect: 56700 },
            { input: 123.123, expect: 123.1 },
            { input: 186950000000, expect: 186900000000 },
            { input: 4096, expect: 4090 },
            { input: 4095, expect: 4095 }
        ];
        for (const _case of lossyCases) {
            const valueBN = USDT.parse(_case.input.toString());
            const valueRounded = float16.round(valueBN);
            assert.equal(Number(USDT.format(valueRounded)), _case.expect);
        }
    });
});
