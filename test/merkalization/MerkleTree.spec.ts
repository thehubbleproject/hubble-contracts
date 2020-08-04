const MTLib = artifacts.require("MerkleTreeUtils");
const nameRegistry = artifacts.require("NameRegistry");
const ParamManager = artifacts.require("ParamManager");
const ECVerify = artifacts.require("ECVerify");
const RollupUtils = artifacts.require("RollupUtils");
const Types = artifacts.require("Types");
import * as walletHelper from "../../scripts/helpers/wallet";
import * as utils from "../../scripts/helpers/utils";
import { Wallet } from "../../scripts/helpers/interfaces";
import { assert } from "chai";

// Test all stateless operations
contract("MerkleTreeUtils", async function(accounts) {
    let wallets: Wallet[];
    var firstDataBlock = utils.StringToBytes32("0x123");
    var secondDataBlock = utils.StringToBytes32("0x334");
    var thirdDataBlock = utils.StringToBytes32("0x4343");
    var fourthDataBlock = utils.StringToBytes32("0x334");
    var dataBlocks = [
        firstDataBlock,
        secondDataBlock,
        thirdDataBlock,
        fourthDataBlock
    ];
    var dataLeaves = [
        utils.Hash(firstDataBlock),
        utils.Hash(secondDataBlock),
        utils.Hash(thirdDataBlock),
        utils.Hash(fourthDataBlock)
    ];
    before(async function() {
        wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
    });

    it("ensure root created on-chain and via utils is the same", async function() {
        const maxSize = 4;
        const numberOfDataLeaves = 2 ** maxSize;
        const dummyHash =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
        const mtlibInstance = await utils.getMerkleTreeUtils();
        for (let i = 1; i < numberOfDataLeaves; i++) {
            const leaves = Array(i).fill(dummyHash);
            const rootFromContract = await mtlibInstance.getMerkleRootFromLeaves(
                leaves
            );
            const rootFromJs = await utils.getMerkleRootFromLeaves(
                leaves,
                maxSize
            );
            assert.equal(
                rootFromContract,
                rootFromJs,
                `Mismatch off-chain and on-chain roots. Leave length is ${i}`
            );
        }
    });

    it("utils hash should be the same as keccak hash", async function() {
        var data = utils.StringToBytes32("0x123");

        var mtlibInstance = await utils.getMerkleTreeUtils();
        var hash = utils.Hash(data);

        var keccakHash = await mtlibInstance.keecakHash(data);
        expect(keccakHash).to.be.deep.eq(hash);
    });

    it("test get parent", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        let localHash = utils.getParentLeaf(firstDataBlock, secondDataBlock);
        let contractHash = await mtlibInstance.getParent(
            firstDataBlock,
            secondDataBlock
        );

        expect(localHash).to.be.deep.eq(contractHash);
    });

    it("test index to path", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        var result = await mtlibInstance.pathToIndex("10", 2);
        expect(result.toNumber()).to.be.deep.eq(2);

        var result2 = await mtlibInstance.pathToIndex("11", 2);
        expect(result2.toNumber()).to.be.deep.eq(3);

        var result3 = await mtlibInstance.pathToIndex("111", 3);
        expect(result3.toNumber()).to.be.deep.eq(7);

        // var result4 = await mtlibInstance.pathToIndex(
        //   "11111111111111111111111",
        //   "11111111111111111111111".length
        // );
        // expect(result4.toNumber()).to.be.deep.eq(8388607);
    });

    it("[LEAF] [STATELESS] verifying correct proof", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[1],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];

        var leaf = dataLeaves[0];

        var path: string = "00";

        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );

        expect(isValid).to.be.deep.eq(true);
    });

    it("[DATABLOCK] [STATELESS] verifying correct proof", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[1],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];

        var leaf = dataBlocks[0];

        var path: string = "00";

        var isValid = await mtlibInstance.verify(root, leaf, path, siblings);

        expect(isValid).to.be.deep.eq(true);
    });

    it("[LEAF] [STATELESS] verifying proof with wrong path", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();
        // create merkle tree and get root
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);
        var siblings: Array<string> = [
            dataLeaves[1],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[0];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(false);
    });

    it("[DATABLOCK] [STATELESS] verifying proof with wrong path", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        // create merkle tree and get root
        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[1],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[0];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(false);
    });

    it("[LEAF] [STATELESS] verifying other leaves", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[0],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[1];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(true);
    });

    it("[DATABLOCK] [STATELESS] verifying other leaves", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[0],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[1];
        var path: string = "01";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(true);
    });

    it("[DATABLOCK] [STATELESS] path greater than depth", async function() {
        var mtlibInstance = await utils.getMerkleTreeUtils();

        var root = await mtlibInstance.getMerkleRoot(dataBlocks);

        var siblings: Array<string> = [
            dataLeaves[0],
            utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
        ];
        var leaf = dataLeaves[1];
        var path: string = "010";
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );

        // TODO fix
        expect(isValid).to.be.deep.eq(false);
    });
});
