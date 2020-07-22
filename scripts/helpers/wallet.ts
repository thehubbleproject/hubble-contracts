const bip39 = require("bip39");
const hdkey = require("ethereumjs-wallet/hdkey");
var packageJSON = require("../../package.json");
export const mnemonics = packageJSON.config.mnemonics;

export function generateFirstWallets(
    mnemonics: any,
    n: number,
    hdPathIndex = 0
) {
    const hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonics));
    const result = [];
    for (let i = 0; i < n; i++) {
        const node = hdwallet.derivePath(`m/44'/60'/0'/0/${i + hdPathIndex}`);
        result.push(node.getWallet());
    }

    return result;
}
