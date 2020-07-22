const MTLib = artifacts.require("MerkleTreeUtils");
const IMT = artifacts.require("IncrementalTree");
const nameRegistry = artifacts.require("NameRegistry");
const ParamManager = artifacts.require("ParamManager");
import * as walletHelper from "../../scripts/helpers/wallet";
import * as utils from "../../scripts/helpers/utils";
const BN = require("bn.js");

contract("IncrementalTree", async function(accounts) {
    var wallets: any;
    var depth: number = 2;
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

    // test if we are able to create append a leaf
    it("create incremental MT and add 2 leaves", async function() {
        // get mtlibInstance
        var mtlibInstance = await utils.getMerkleTreeUtils();

        // get IMT tree instance
        let IMTInstace = await IMT.deployed();

        // get leaf to be inserted
        var leaf = dataLeaves[0];
        var coordinator =
            "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
        var zeroLeaf = await mtlibInstance.getRoot(0);
        var zeroLeaf1 = await mtlibInstance.getRoot(1);
        var zeroLeaf2 = await mtlibInstance.getRoot(2);
        var zeroLeaf3 = await mtlibInstance.getRoot(3);

        // append leaf to the tree
        await IMTInstace.appendLeaf(leaf);

        // validate if the leaf was inserted correctly
        var root = await IMTInstace.getTreeRoot();
        var path = "2";
        var siblings = [coordinator, zeroLeaf1, zeroLeaf2, zeroLeaf3];

        // call stateless merkle tree utils
        var isValid = await mtlibInstance.verifyLeaf(
            root,
            leaf,
            path,
            siblings
        );
        expect(isValid).to.be.deep.eq(true);

        // add another leaf to the tree
        leaf = dataLeaves[1];
        await IMTInstace.appendLeaf(leaf);
        var nextLeafIndex = await IMTInstace.nextLeafIndex();
        // verify that the new leaf was inserted correctly
        var root1 = await IMTInstace.getTreeRoot();

        var pathToSecondAccount = "3";
        var siblings2 = [
            dataLeaves[0],
            utils.getParentLeaf(coordinator, coordinator),
            zeroLeaf2,
            zeroLeaf3
        ];
        isValid = await mtlibInstance.verifyLeaf(
            root1,
            leaf,
            pathToSecondAccount,
            siblings2
        );
        expect(isValid).to.be.deep.eq(true);
    });
});

/**
 * Converts a big number to a hex string.
 * @param bn the big number to be converted.
 * @returns the big number as a string.
 */
export const bnToHexString = (bn: BN): string => {
    return "0x" + bn.toString("hex");
};

/**
 * Converts a buffer to a hex string.
 * @param buf the buffer to be converted.
 * @returns the buffer as a string.
 */
export const bufToHexString = (buf: Buffer): string => {
    return "0x" + buf.toString("hex");
};
