import { ethers } from "ethers";
import * as utils from '../scripts/helpers/utils'
import { setup } from '../scripts/helpers/setup'
const RollupCore = artifacts.require("Rollup");
const RollupUtils = artifacts.require("RollupUtils");
const IMT = artifacts.require("IncrementalTree");

contract("airdrop", async function () {

    const tokenType = 1
    const epoch = 1

    xit("lets coordinator submit a batch", async function () {
        const { wallets, zeroAccountMerkleProof, Alice, Bob, AliceAccountMP, alicePDAProof } = await setup()
        const RollupUtilsInstance = await RollupUtils.deployed()
        const rollupCoreInstance = await RollupCore.deployed()
        const IMTInstance = await IMT.deployed()
        const dropAlice = {
            toIndex: Alice.AccID,
            tokenType: tokenType,
            epoch: epoch,
            amount: 10,
            signature: "0xabcd"
        }
        const dropAliceHash = await RollupUtilsInstance.getDropSignBytes(
            dropAlice.toIndex, dropAlice.tokenType, dropAlice.epoch, dropAlice.amount
        )
        console.log("dropAliceHash", dropAliceHash)
        dropAlice.signature = utils.sign(dropAliceHash, wallets[0])
        const dropBob = {
            toIndex: Bob.AccID,
            tokenType: tokenType,
            epoch: epoch,
            amount: 10,
            signature: "0xabcd"
        }
        const dropBobHash = await RollupUtilsInstance.getDropSignBytes(
            dropBob.toIndex, dropBob.tokenType, dropBob.epoch, dropBob.amount
        )
        dropBob.signature = utils.sign(dropBobHash, wallets[0])

        const compressedDrop1 = await RollupUtilsInstance.CompressDropNoStruct(
            dropAlice.toIndex, dropAlice.tokenType, dropAlice.epoch, dropAlice.amount
        )
        console.log("compressedDrop1", compressedDrop1)
        const accountProofs = {
            from: {
                accountIP: {
                    pathToAccount: '',
                    account: {
                        ID: 0,
                        tokenType: 0,
                        balance: 0,
                        nonce: 0,
                    },
                },
                siblings: []
            },
            to: AliceAccountMP,
        };


        const currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
        const accountRoot = await IMTInstance.getTreeRoot();

        const result = await rollupCoreInstance.processTx(
            currentRoot,
            accountRoot,
            compressedDrop1,
            alicePDAProof,
            accountProofs,
            utils.Usage.Airdrop
        )
        console.log("result", result)

        await rollupCoreInstance.submitBatch(
            ["0xabc", "0xabc"],
            "0xb6b4b5c6cb43071b3913b1d500b33c52392f7aa85f8a451448e20c3967f2b21a",
            utils.Usage.Airdrop,
            { value: ethers.utils.parseEther("32").toString() },
        )

        // create drops 

        // createAirdropBatch(drops, dropTokenType, rollupInstance, coordinator_wallet)

        // rollupCoreInstance.submitBatch
    })

    it("lets anybody dispute a batch", async function () {

    })

})
