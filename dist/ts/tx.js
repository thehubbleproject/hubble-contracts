"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TxCreate2Transfer = exports.TxMassMigration = exports.TxTransfer = exports.serialize = void 0;
const utils_1 = require("./utils");
const decimal_1 = require("./decimal");
const exceptions_1 = require("./exceptions");
const utils_2 = require("ethers/lib/utils");
const constants_1 = require("./constants");
const amountLen = 2;
const feeLen = 2;
const stateIDLen = 4;
const nonceLen = 4;
const spokeLen = 4;
function serialize(txs) {
    return utils_2.hexlify(utils_2.concat(txs.map(tx => tx.encode())));
}
exports.serialize = serialize;
function checkByteLength(decimal, fieldName, expected) {
    if (decimal.bytesLength != expected) {
        throw new exceptions_1.MismatchByteLength(`Deciaml: ${decimal.bytesLength} bytes, ${fieldName}: ${expected} bytes`);
    }
}
class TxTransfer {
    constructor(fromIndex, toIndex, amount, fee, nonce, decimal) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.amount = amount;
        this.fee = fee;
        this.nonce = nonce;
        this.decimal = decimal;
        this.TX_TYPE = "0x01";
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }
    static rand() {
        const sender = utils_1.randomNum(stateIDLen);
        const receiver = utils_1.randomNum(stateIDLen);
        const amount = decimal_1.USDT.randInt();
        const fee = decimal_1.USDT.randInt();
        const nonce = utils_1.randomNum(nonceLen);
        return new TxTransfer(sender, receiver, amount, fee, nonce, decimal_1.USDT);
    }
    static buildList(n = constants_1.COMMIT_SIZE) {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxTransfer.rand());
        }
        return txs;
    }
    message() {
        return utils_2.solidityPack(["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], [
            this.TX_TYPE,
            this.fromIndex,
            this.toIndex,
            this.nonce,
            this.amount,
            this.fee
        ]);
    }
    encodeOffchain() {
        return utils_2.solidityPack(["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], [
            this.TX_TYPE,
            this.fromIndex,
            this.toIndex,
            this.amount,
            this.fee,
            this.nonce
        ]);
    }
    encode() {
        const concated = utils_2.concat([
            utils_2.hexZeroPad(utils_2.hexlify(this.fromIndex), stateIDLen),
            utils_2.hexZeroPad(utils_2.hexlify(this.toIndex), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee)
        ]);
        return utils_2.hexlify(concated);
    }
}
exports.TxTransfer = TxTransfer;
class TxMassMigration {
    constructor(fromIndex, amount, spokeID, fee, nonce, decimal) {
        this.fromIndex = fromIndex;
        this.amount = amount;
        this.spokeID = spokeID;
        this.fee = fee;
        this.nonce = nonce;
        this.decimal = decimal;
        this.TX_TYPE = "0x05";
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }
    static rand() {
        const sender = utils_1.randomNum(stateIDLen);
        const amount = decimal_1.USDT.randInt();
        const fee = decimal_1.USDT.randInt();
        const nonce = utils_1.randomNum(nonceLen);
        const spokeID = utils_1.randomNum(spokeLen);
        return new TxMassMigration(sender, amount, spokeID, fee, nonce, decimal_1.USDT);
    }
    static buildList(n = constants_1.COMMIT_SIZE) {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxMassMigration.rand());
        }
        return txs;
    }
    message() {
        return utils_2.solidityPack(["uint8", "uint32", "uint256", "uint256", "uint32", "uint32"], [
            this.TX_TYPE,
            this.fromIndex,
            this.amount,
            this.fee,
            this.nonce,
            this.spokeID
        ]);
    }
    encodeOffchain() {
        return utils_2.solidityPack(["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"], [
            this.TX_TYPE,
            this.fromIndex,
            this.amount,
            this.fee,
            this.spokeID,
            this.nonce
        ]);
    }
    encode() {
        const concated = utils_2.concat([
            utils_2.hexZeroPad(utils_2.hexlify(this.fromIndex), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee)
        ]);
        return utils_2.hexlify(concated);
    }
}
exports.TxMassMigration = TxMassMigration;
class TxCreate2Transfer {
    constructor(fromIndex, toIndex, fromPubkey, toPubkey, toAccID, amount, fee, nonce, decimal) {
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.fromPubkey = fromPubkey;
        this.toPubkey = toPubkey;
        this.toAccID = toAccID;
        this.amount = amount;
        this.fee = fee;
        this.nonce = nonce;
        this.decimal = decimal;
        this.TX_TYPE = "0x03";
        checkByteLength(decimal, "amount", amountLen);
        checkByteLength(decimal, "fee", feeLen);
    }
    static rand() {
        const sender = utils_1.randomNum(stateIDLen);
        const receiver = utils_1.randomNum(stateIDLen);
        const senderPub = [];
        const receiverPub = [];
        const toAccID = utils_1.randomNum(stateIDLen);
        const amount = decimal_1.USDT.randInt();
        const fee = decimal_1.USDT.randInt();
        const nonce = utils_1.randomNum(nonceLen);
        return new TxCreate2Transfer(sender, receiver, senderPub, receiverPub, toAccID, amount, fee, nonce, decimal_1.USDT);
    }
    static buildList(n = constants_1.COMMIT_SIZE) {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxCreate2Transfer.rand());
        }
        return txs;
    }
    message() {
        return utils_2.solidityPack([
            "uint256",
            "uint256[4]",
            "uint256[4]",
            "uint256",
            "uint256",
            "uint256"
        ], [
            this.TX_TYPE,
            this.fromPubkey,
            this.toPubkey,
            this.nonce,
            this.amount,
            this.fee
        ]);
    }
    encodeOffchain() {
        return utils_2.solidityPack([
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256",
            "uint256"
        ], [
            this.TX_TYPE,
            this.fromIndex,
            this.toIndex,
            this.toAccID,
            this.amount,
            this.fee,
            this.nonce
        ]);
    }
    encode() {
        const concated = utils_2.concat([
            utils_2.hexZeroPad(utils_2.hexlify(this.fromIndex), stateIDLen),
            utils_2.hexZeroPad(utils_2.hexlify(this.toIndex), stateIDLen),
            utils_2.hexZeroPad(utils_2.hexlify(this.toAccID), stateIDLen),
            this.decimal.encodeInt(this.amount),
            this.decimal.encodeInt(this.fee)
        ]);
        return utils_2.hexlify(concated);
    }
}
exports.TxCreate2Transfer = TxCreate2Transfer;
//# sourceMappingURL=tx.js.map