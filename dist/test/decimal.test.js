"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const decimal_1 = require("../ts/decimal");
const exceptions_1 = require("../ts/exceptions");
describe("Decimal", () => {
    const goodCases = [0, 1, 10000, 12.13, 0.1234, 18690000000];
    it("Get's some property right", () => {
        chai_1.assert.equal(decimal_1.USDT.bytesLength, 2);
    });
    it("Compresses and decompresses values", () => {
        for (const value of goodCases) {
            chai_1.assert.equal(decimal_1.USDT.decode(decimal_1.USDT.encode(value)), value, `Mismatch Encode and decode of ${value}`);
        }
    });
    it("Compresses and decompresses random values", () => {
        let value;
        for (let i = 0; i <= 20; i++) {
            value = decimal_1.USDT.randNum();
            chai_1.assert.equal(decimal_1.USDT.decode(decimal_1.USDT.encode(value)), value, `Mismatch Encode and decode of ${value}`);
        }
    });
    it("throws for bad cases", () => {
        const failingCases = [0.12345, 56789, 123.123];
        for (const value of failingCases) {
            chai_1.assert.throws(() => {
                decimal_1.USDT.encode(value);
            }, exceptions_1.EncodingError);
        }
    });
    it("casts values", () => {
        for (const value of goodCases) {
            chai_1.assert.equal(decimal_1.USDT.cast(value), value, "Casted value should be the same in good cases");
        }
        chai_1.assert.equal(decimal_1.USDT.cast(0.12345), 0.1234);
        chai_1.assert.equal(decimal_1.USDT.cast(56789), 56700);
        chai_1.assert.equal(decimal_1.USDT.cast(123.123), 123.1);
        chai_1.assert.equal(decimal_1.USDT.cast(186950000000), 186900000000);
        chai_1.assert.equal(decimal_1.USDT.cast(4096), 4090);
        chai_1.assert.equal(decimal_1.USDT.cast(4095), 4095);
    });
});
//# sourceMappingURL=decimal.test.js.map