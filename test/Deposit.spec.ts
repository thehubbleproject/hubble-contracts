import * as walletHelper from "../scripts/helpers/wallet";
import { Wallet } from "../scripts/helpers/interfaces";

describe("DepositManager", async function() {
    let wallets: Wallet[];
    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
    });

    it("should allow depositing 2 leaves in a subtree and merging it", async () => {});
});
