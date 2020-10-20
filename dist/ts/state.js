"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.State = exports.EMPTY_STATE = void 0;
const mcl = __importStar(require("./mcl"));
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
/**
 * @dev this is not an zero state leaf contrarily this is a legit state!
 */
exports.EMPTY_STATE = {
    pubkeyIndex: 0,
    tokenType: 0,
    balance: 0,
    nonce: 0
};
class State {
    constructor(pubkeyIndex, tokenType, balance, nonce) {
        this.pubkeyIndex = pubkeyIndex;
        this.tokenType = tokenType;
        this.balance = balance;
        this.nonce = nonce;
        this.publicKey = ["0x", "0x", "0x", "0x"];
        this.stateID = -1;
    }
    static new(pubkeyIndex, tokenType, balance, nonce) {
        return new State(pubkeyIndex, tokenType, ethers_1.BigNumber.from(balance), nonce);
    }
    // TODO add optional params for pubkey and stateID
    clone() {
        return new State(this.pubkeyIndex, this.tokenType, this.balance, this.nonce);
    }
    newKeyPair() {
        const keyPair = mcl.newKeyPair();
        this.publicKey = keyPair.pubkey;
        this.secretKey = keyPair.secret;
        return this;
    }
    sign(tx) {
        const msg = tx.message();
        const { signature } = mcl.sign(msg, this.secretKey);
        return signature;
    }
    setStateID(stateID) {
        this.stateID = stateID;
        return this;
    }
    setPubkey(pubkey) {
        this.publicKey = pubkey;
        return this;
    }
    getPubkey() {
        return this.publicKey;
    }
    encode() {
        return utils_1.solidityPack(["uint256", "uint256", "uint256", "uint256"], [this.pubkeyIndex, this.tokenType, this.balance, this.nonce]);
    }
    toStateLeaf() {
        return ethers_1.ethers.utils.solidityKeccak256(["uint256", "uint256", "uint256", "uint256"], [this.pubkeyIndex, this.tokenType, this.balance, this.nonce]);
    }
    toSolStruct() {
        return {
            pubkeyIndex: this.pubkeyIndex,
            tokenType: this.tokenType,
            balance: this.balance.toNumber(),
            nonce: this.nonce
        };
    }
    toAccountLeaf() {
        const publicKey = mcl.g2ToHex(this.publicKey);
        return ethers_1.ethers.utils.solidityKeccak256(["uint256", "uint256", "uint256", "uint256"], publicKey);
    }
}
exports.State = State;
//# sourceMappingURL=state.js.map