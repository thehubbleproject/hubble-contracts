const MTLib = artifacts.require("MerkleTreeUtils");
const IMT = artifacts.require("IncrementalTree");
const nameRegistry = artifacts.require("NameRegistry");
const ParamManager = artifacts.require("ParamManager");
import * as walletHelper from "../helpers/wallet";
import * as utils from "../helpers/utils";
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
    var zeroLeaf = await mtlibInstance.getRoot(0);
    var zeroLeaf1 = await mtlibInstance.getRoot(1);
    var zeroLeaf2 = await mtlibInstance.getRoot(2);
    var zeroLeaf3 = await mtlibInstance.getRoot(3);

    console.log(
      "data",
      zeroLeaf,
      zeroLeaf1,
      zeroLeaf2,
      zeroLeaf3,
      utils.getParentLeaf(zeroLeaf, zeroLeaf)
    );

    // append leaf to the tree
    await IMTInstace.appendLeaf(leaf);

    // validate if the leaf was inserted correctly
    var root = await IMTInstace.getTreeRoot();
    var path = "0000";
    var siblings = [zeroLeaf, zeroLeaf1, zeroLeaf2, zeroLeaf3];

    // call stateless merkle tree utils
    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);
    expect(isValid).to.be.deep.eq(true);

    // add another leaf to the tree
    leaf = dataLeaves[1];
    await IMTInstace.appendLeaf(leaf);

    // verify that the new leaf was inserted correctly
    root = await IMTInstace.getTreeRoot();
    path = "0001";
    var siblings2 = [dataLeaves[0], zeroLeaf1, zeroLeaf2, zeroLeaf3];

    // validate using mt utils
    isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings2);
    expect(isValid).to.be.deep.eq(true);
  });
});
