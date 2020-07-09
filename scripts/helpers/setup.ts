import { generateFirstWallets, mnemonics } from "./wallet";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const RollupUtils = artifacts.require("RollupUtils");
import {
    getTokenRegistry,
    defaultHashes as getDefaultHashes,
    getParentLeaf,
    CreateAccountLeaf,
    PubKeyHash
} from './utils'
import { ethers } from "ethers";

export async function setup() {
    const wallets = generateFirstWallets(mnemonics, 10);
    const depositManagerInstance = await DepositManager.deployed();
    const testTokenInstance = await TestToken.deployed();
    const rollupCoreInstance = await RollupCore.deployed();

    const RollupUtilsInstance = await RollupUtils.deployed();
    const tokenRegistryInstance = await getTokenRegistry();
    await tokenRegistryInstance.requestTokenRegistration(testTokenInstance.address, {
        from: wallets[0].getAddressString(),
    });
    await tokenRegistryInstance.finaliseTokenRegistration(testTokenInstance.address, {
        from: wallets[0].getAddressString(),
    });
    const coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
    await testTokenInstance.approve(
        depositManagerInstance.address,
        web3.utils.toWei("1"),
        {
            from: wallets[0].getAddressString(),
        }
    );

    const Alice = {
        Address: wallets[0].getAddressString(),
        Pubkey: wallets[0].getPublicKeyString(),
        Amount: 10,
        TokenType: 1,
        AccID: 1,
        Path: "2",
    };
    const Bob = {
        Address: wallets[1].getAddressString(),
        Pubkey: wallets[1].getPublicKeyString(),
        Amount: 10,
        TokenType: 1,
        AccID: 2,
        Path: "3",
    };

    await testTokenInstance.transfer(Alice.Address, 100);
    await depositManagerInstance.deposit(
        Alice.Amount,
        Alice.TokenType,
        Alice.Pubkey
    );
    await depositManagerInstance.depositFor(
        Bob.Address,
        Bob.Amount,
        Bob.TokenType,
        Bob.Pubkey
    );

    // finalise the deposit back to the state tree
    const path = "001";
    const defaultHashes = await getDefaultHashes(4);
    const siblingsInProof = [
        getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
        defaultHashes[2],
        defaultHashes[3],
    ];

    const zeroAccountMerkleProof = {
        accountIP: {
            pathToAccount: path,
            account: {
                ID: 0,
                tokenType: 0,
                balance: 0,
                nonce: 0,
            },
        },
        siblings: siblingsInProof,
    };

    const subtreeDepth = 1;
    await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
        subtreeDepth,
        zeroAccountMerkleProof,
        { value: ethers.utils.parseEther("32").toString() }
    );
    const BobAccountLeaf = await CreateAccountLeaf(
        Bob.AccID,
        Bob.Amount,
        0,
        Bob.TokenType
    );
    const AliceAccountSiblings: Array<string> = [
        BobAccountLeaf,
        getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
        defaultHashes[2],
        defaultHashes[3],
    ];
    const AliceAccountMP = {
        accountIP: {
            pathToAccount: Alice.Path,
            account: {
                ID: Alice.AccID,
                tokenType: Alice.TokenType,
                balance: Alice.Amount,
                nonce: 0,
            },
        },
        siblings: AliceAccountSiblings,
    };
    const coordinatorPubkeyHash =
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    const AlicePDAsiblings = [
        PubKeyHash(Bob.Pubkey),
        getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
        defaultHashes[2],
        defaultHashes[3],
    ];
    const alicePDAProof = {
        _pda: {
            pathToPubkey: "2",
            pubkey_leaf: { pubkey: Alice.Pubkey },
        },
        siblings: AlicePDAsiblings,
    };
    return {
        Alice,
        Bob,
        wallets,
        zeroAccountMerkleProof,
        AliceAccountMP,
        alicePDAProof,
    }
}