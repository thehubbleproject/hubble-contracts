const contracts = require("../contractAddresses.json");
const walletHelper = require("./helpers/wallet");
const MerkleTreeUtils = artifacts.require("MerkleTreeUtils");
const ParamManager = artifacts.require("ParamManager");
const nameRegistry = artifacts.require("NameRegistry");
const TokenRegistry = artifacts.require("TokenRegistry");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const RollupCore = artifacts.require("Rollup");

async function stake() {
  // get deployed name registry instance
  var nameRegistryInstance = await nameRegistry.deployed();

  // get deployed parama manager instance
  var paramManager = await ParamManager.deployed();

  // get accounts tree key
  var tokenRegistryKey = await paramManager.TOKEN_REGISTRY();

  var tokenRegistryAddress = await nameRegistryInstance.getContractDetails(
    tokenRegistryKey
  );

  var wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);

  let testToken = await TestToken.deployed();
  let tokenRegistryInstance = await utils.getTokenRegistry();
  let depositManagerInstance = await DepositManager.deployed();

  await tokenRegistryInstance.requestTokenRegistration(testToken.address, {
    from: wallets[0].getAddressString(),
  });

  await tokenRegistryInstance.finaliseTokenRegistration(testToken.address, {
    from: wallets[0].getAddressString(),
  });

  await testToken.approve(
    depositManagerInstance.address,
    web3.utils.toWei("1"),
    {
      from: wallets[0].getAddressString(),
    }
  );

  var Alice = {
    Address: wallets[0].getAddressString(),
    Pubkey: wallets[0].getPublicKeyString(),
    Amount: 10,
    TokenType: 1,
    AccID: 1,
    Path: "2",
  };

  var Bob = {
    Address: wallets[1].getAddressString(),
    Pubkey: wallets[1].getPublicKeyString(),
    Amount: 10,
    TokenType: 1,
    AccID: 2,
    Path: "3",
  };

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

  // await depositManagerInstance.depositFor(
  //   Bob.Address,
  //   Bob.Amount,
  //   Bob.TokenType,
  //   Bob.Pubkey
  // );
  // await depositManagerInstance.depositFor(
  //   Bob.Address,
  //   Bob.Amount,
  //   Bob.TokenType,
  //   Bob.Pubkey
  // );
}

stake();
