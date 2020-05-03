const MTLib = artifacts.require("MerkleTreeUtils");
const IMT = artifacts.require("IncrementalTree.sol");
const Tree = artifacts.require("Tree");
const nameRegistry = artifacts.require("NameRegistry");
const ParamManager = artifacts.require("ParamManager");
const ECVerify = artifacts.require("ECVerify");
const RollupUtils = artifacts.require("RollupUtils");
const Types = artifacts.require("Types");
import * as walletHelper from "../helpers/wallet";
import * as utils from "../helpers/utils";
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
    var balancesTree = await Tree.deployed();
    var path = "00";
    await balancesTree.updateLeaf(dataLeaves[0], path);
    var root = await balancesTree.getRoot();
    var siblings0 = await balancesTree.getSiblings.call(path);
    var siblings: Array<string> = [
      dataLeaves[1],
      utils.getParentLeaf(dataLeaves[2], dataLeaves[3])
    ];

    var nameRegistryInstance = await nameRegistry.deployed();
    var paramManager = await ParamManager.deployed();
    var mtLibKey = await paramManager.MERKLE_UTILS();
    var MtUtilsAddr = await nameRegistryInstance.getContractDetails(mtLibKey);
    var mtlibInstance = await MTLib.at(MtUtilsAddr);
    var isValid = await mtlibInstance.verifyLeaf(
      root,
      dataLeaves[0],
      path,
      siblings
    );
    expect(isValid).to.be.deep.eq(false);
  });
});
