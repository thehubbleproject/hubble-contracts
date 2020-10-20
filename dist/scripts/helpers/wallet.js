"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFirstWallets = exports.mnemonics = void 0;
const bip39 = require("bip39");
const hdkey = require("ethereumjs-wallet/hdkey");
const packageJSON = require("../../package.json");
exports.mnemonics = packageJSON.config.mnemonics;
function generateFirstWallets(mnemonics, n, hdPathIndex = 0) {
    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonics));
    const result = [];
    for (let i = 0; i < n; i++) {
        const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex}`);
        result.push(node.getWallet());
    }
    return result;
}
exports.generateFirstWallets = generateFirstWallets;
//# sourceMappingURL=wallet.js.map