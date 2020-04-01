const MTLib = artifacts.require("MerkleTreeLib");
const IMT = artifacts.require("IncrementalTree.sol");
const Tree = artifacts.require("Tree");

import * as walletHelper from "../helpers/wallet";
import * as utils from "../helpers/utils";
// Test all stateless operations
contract("MerkelTreeLib", async function(accounts) {
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

  it("utils hash should be the same as keccak hash", async function() {
    var data = utils.StringToBytes32("0x123");
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });
    var hash = utils.Hash(data);

    var keccakHash = await mtlibInstance.keecakHash(data);
    expect(keccakHash).to.be.deep.eq(hash);
  });

  it("test get parent", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });
    let localHash = utils.getParentLeaf(firstDataBlock, secondDataBlock);
    let contractHash = await mtlibInstance.getParent(
      firstDataBlock,
      secondDataBlock
    );
    expect(localHash).to.be.deep.eq(contractHash);
  });

  it("[LEAF] [STATELESS] verifying correct proof", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

    var siblings: Array<string> = [
      dataLeaves[1],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];

    var leaf = dataLeaves[0];

    var path: string = "00";

    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);

    expect(isValid).to.be.deep.eq(true);
  });

  it("[DATABLOCK] [STATELESS] verifying correct proof", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

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
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    // create merkle tree and get root
    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

    var siblings: Array<string> = [
      dataLeaves[1],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];
    var leaf = dataLeaves[0];
    var path: string = "01";
    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);
    expect(isValid).to.be.deep.eq(false);
  });

  it("[DATABLOCK] [STATELESS] verifying proof with wrong path", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    // create merkle tree and get root
    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

    var siblings: Array<string> = [
      dataLeaves[1],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];
    var leaf = dataLeaves[0];
    var path: string = "01";
    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);
    expect(isValid).to.be.deep.eq(false);
  });

  it("[LEAF] [STATELESS] verifying other leaves", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

    var siblings: Array<string> = [
      dataLeaves[0],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];
    var leaf = dataLeaves[1];
    var path: string = "01";
    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);
    expect(isValid).to.be.deep.eq(true);
  });

  it("[DATABLOCK] [STATELESS] verifying other leaves", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

    var siblings: Array<string> = [
      dataLeaves[0],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];
    var leaf = dataLeaves[1];
    var path: string = "01";
    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);
    expect(isValid).to.be.deep.eq(true);
  });

  it("[DATABLOCK] [STATELESS] path greater than depth", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    var root = await mtlibInstance.getMerkleRoot.call(dataBlocks);

    var siblings: Array<string> = [
      dataLeaves[0],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];
    var leaf = dataLeaves[1];
    var path: string = "010";
    var isValid = await mtlibInstance.verifyLeaf(root, leaf, path, siblings);

    // TODO fix
    expect(isValid).to.be.deep.eq(false);
  });
});

contract("Tree", async function(accounts) {
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

  it("should be able to add a new leaf at a particular index", async function() {
    var mtlibInstance = await MTLib.new(depth, {
      from: wallets[0].getAddressString()
    });

    var balancesTree = await Tree.new(mtlibInstance.address, {
      from: wallets[0].getAddressString()
    });
    var path = "00";
    await balancesTree.updateLeaf(dataLeaves[0], "00");
    var root = await balancesTree.getRoot();
    // var siblings = await balancesTree.getSiblings(path);
    var siblings: Array<string> = [
      dataLeaves[1],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];

    console.log("data", root, dataLeaves[0], path, siblings);
    var isValid = await mtlibInstance.verifyLeaf(
      root,
      dataLeaves[0],
      path,
      siblings
    );
    expect(isValid).to.be.deep.eq(false);
  });
});
