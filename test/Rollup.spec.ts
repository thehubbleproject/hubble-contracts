import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
import { Transaction, ErrorCode } from "../scripts/helpers/interfaces";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const EcVerify = artifacts.require("ECVerify");

contract("Rollup", async function (accounts) {
  var wallets: any;

  let depositManagerInstance: any;
  let testTokenInstance: any;
  let rollupCoreInstance: any;
  let MTutilsInstance: any;
  let testToken: any;
  let RollupUtilsInstance: any;
  let tokenRegistryInstance: any;
  let IMTInstance: any;

  let Alice: any;
  let Bob: any;

  let coordinator_leaves: any;
  let coordinatorPubkeyHash: any;
  let maxSize: any;
  var zeroHashes: any;

  let falseBatchZero: any;
  let falseBatchOne: any;
  let falseBatchTwo: any;
  let falseBatchThree: any;
  let falseBatchFour: any;
  let falseBatchFive: any;
  let falseBatchComb: any;

  let AlicePDAsiblings: any;

  let BobPDAsiblings: any;

  let alicePDAProof: any;

  before(async function () {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);
    depositManagerInstance = await DepositManager.deployed();
    testTokenInstance = await TestToken.deployed();
    rollupCoreInstance = await RollupCore.deployed();
    MTutilsInstance = await utils.getMerkleTreeUtils();
    testToken = await TestToken.deployed();
    RollupUtilsInstance = await RollupUtils.deployed();
    tokenRegistryInstance = await utils.getTokenRegistry();
    IMTInstance = await IMT.deployed();

    Alice = {
      Address: wallets[0].getAddressString(),
      Pubkey: wallets[0].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 2,
      Path: "2",
      nonce: 0
    };
    Bob = {
      Address: wallets[1].getAddressString(),
      Pubkey: wallets[1].getPublicKeyString(),
      Amount: 10,
      TokenType: 1,
      AccID: 3,
      Path: "3",
      nonce: 0
    };

    coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
    coordinatorPubkeyHash =
      "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563";
    maxSize = 4;
    zeroHashes = await utils.defaultHashes(maxSize);

    AlicePDAsiblings = [
      utils.PubKeyHash(Bob.Pubkey),
      utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
      zeroHashes[2],
      zeroHashes[3],
    ];

    BobPDAsiblings = [
      utils.PubKeyHash(Alice.Pubkey),
      utils.getParentLeaf(
        coordinatorPubkeyHash,
        utils.PubKeyHash(Alice.Pubkey)
      ),
      zeroHashes[2],
      zeroHashes[3],
    ];

    alicePDAProof = {
      _pda: {
        pathToPubkey: "2",
        pubkey_leaf: { pubkey: Alice.Pubkey },
      },
      siblings: AlicePDAsiblings,
    };

  });

  // test if we are able to create append a leaf
  it("make a deposit of 2 accounts", async function () {
    await tokenRegistryInstance.requestTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString(),
    });
    await tokenRegistryInstance.finaliseTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString(),
    });
    await testToken.approve(
      depositManagerInstance.address,
      ethers.utils.parseEther("1"),
      {
        from: wallets[0].getAddressString(),
      }
    );

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

    var subtreeDepth = 1;

    // finalise the deposit back to the state tree
    var path = "001";
    var defaultHashes = await utils.defaultHashes(maxSize);
    var siblingsInProof = [
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      defaultHashes[2],
      defaultHashes[3],
    ];

    var _zero_account_mp = {
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

    await rollupCoreInstance.finaliseDepositsAndSubmitBatch(
      subtreeDepth,
      _zero_account_mp,
      { value: ethers.utils.parseEther("32").toString() }
    );
  });

  it("submit new batch 1st", async function () {
    var AliceAccountLeaf = await utils.createLeaf(Alice);
    var BobAccountLeaf = await utils.createLeaf(Bob);

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();
    
    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(Alice.Pubkey),
      "2",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var tx: Transaction = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: Alice.TokenType,
      amount: tranferAmount,
      txType: 1,
      nonce: 1
    };

    tx.signature = await utils.signTx(tx, wallets[0]);

    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);


    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: Alice.AccID,
          tokenType: Alice.TokenType,
          balance: Alice.Amount,
          nonce: Alice.nonce,
        },
      },
      siblings: AliceAccountSiblings,
    };

    Alice.Amount -= Number(tx.amount);
    Alice.nonce++;

    var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);
    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      UpdatedAliceAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: Bob.AccID,
          tokenType: Bob.TokenType,
          balance: Bob.Amount,
          nonce: Bob.nonce,
        },
      },
      siblings: BobAccountSiblings,
    };

    Bob.Amount += Number(tx.amount);

    var accountProofs = {
      from: AliceAccountMP,
      to: BobAccountMP,
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );

    console.log("result from processTx: " + JSON.stringify(result));
    await utils.compressAndSubmitBatch(tx, result[0])

    falseBatchZero = {
      batchId: 0,
      txs: [tx],
      batchProofs: {
        accountProofs: [accountProofs],
        pdaProof: [alicePDAProof]
      }
    }
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    falseBatchZero.batchId = Number(batchId) - 1;
  });

  it("dispute batch correct 1th batch(no error)", async function () {
    await rollupCoreInstance.disputeBatch(
      falseBatchZero.batchId,
      falseBatchZero.txs,
      falseBatchZero.batchProofs,
    );
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    let batchMarker = await rollupCoreInstance.invalidBatchMarker();
    assert.equal(batchMarker, "0", "batchMarker is not zero");
    assert.equal(batchId - 1 , falseBatchZero.batchId, "dispute shouldnt happen");
  })

  it("submit new batch 2nd(False Batch)", async function () {
    var AliceAccountLeaf = await utils.createLeaf(Alice);
    var BobAccountLeaf = await utils.createLeaf(Bob);

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();

    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(Alice.Pubkey),
      "2",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var tx: Transaction = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      // tokenType: Alice.TokenType,
      tokenType: 2, // false token type (Token not valid)
      amount: tranferAmount,
      txType: 1,
      nonce: 2
    };
    tx.signature = await utils.signTx(tx, wallets[0]);

    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);
    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: Alice.AccID,
          tokenType: Alice.TokenType,
          balance: Alice.Amount,
          nonce: Alice.nonce,
        },
      },
      siblings: AliceAccountSiblings,
    };

    Alice.Amount -= Number(tx.amount);
    Alice.nonce++;

    var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      UpdatedAliceAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: Bob.AccID,
          tokenType: Bob.TokenType,
          balance: Bob.Amount,
          nonce: Bob.nonce,
        },
      },
      siblings: BobAccountSiblings,
    };

    Bob.Amount += Number(tx.amount);
    var accountProofs = {
      from: AliceAccountMP,
      to: BobAccountMP,
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );

    var falseResult = await utils.falseProcessTx(
      tx,
      accountProofs
    );
    assert.equal(result[3], ErrorCode.InvalidTokenAddress, "False error ID. It should be `1`");
    await utils.compressAndSubmitBatch(tx, falseResult)

    falseBatchOne = {
      batchId: 0,
      txs: [tx],
      batchProofs: {
        accountProofs: [accountProofs],
        pdaProof: [alicePDAProof]
      }
    }
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    falseBatchOne.batchId = Number(batchId) - 1;
    // console.log(falseBatchOne)
  });
  it("dispute batch false 2nd batch(Tx Token Type not valid)", async function () {
    await rollupCoreInstance.disputeBatch(
      falseBatchOne.batchId,
      falseBatchOne.txs,
      falseBatchOne.batchProofs,
    );
    
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    let batchMarker = await rollupCoreInstance.invalidBatchMarker();
    assert.equal(batchMarker, "0", "invalidBatchMarker is not zero");
    assert.equal(batchId -1 , falseBatchOne.batchId - 1, "batchId doesnt match");
    Alice.Amount += falseBatchOne.txs[0].amount;
    Bob.Amount -= falseBatchOne.txs[0].amount;
    Alice.nonce--;
  })


  it("submit new batch 3rd", async function () {
    var AliceAccountLeaf = await utils.createLeaf(Alice);
    var BobAccountLeaf = await utils.createLeaf(Bob);

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();

    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(Alice.Pubkey),
      "2",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var tx: Transaction = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: Alice.TokenType,
      amount: 0, // Error
      txType: 1,
      nonce: 2
    };
    tx.signature = await utils.signTx(tx, wallets[0]);

    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);
    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: Alice.AccID,
          tokenType: Alice.TokenType,
          balance: Alice.Amount,
          nonce: Alice.nonce,
        },
      },
      siblings: AliceAccountSiblings,
    };

    Alice.Amount -= Number(tx.amount);
    Alice.nonce++;

    var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      UpdatedAliceAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";
    var isBobValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      BobAccountPath,
      BobAccountSiblings
    );

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: Bob.AccID,
          tokenType: Bob.TokenType,
          balance: Bob.Amount,
          nonce: Bob.nonce,
        },
      },
      siblings: BobAccountSiblings,
    };

    Bob.Amount += Number(tx.amount);
    var accountProofs = {
      from: AliceAccountMP,
      to: BobAccountMP,
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );

    var falseResult = await utils.falseProcessTx(
      tx,
      accountProofs
    );
    assert.equal(result[3], ErrorCode.InvalidTokenAmount, "false Error Id. It should be `2`.");

    await utils.compressAndSubmitBatch(tx, falseResult)

    falseBatchTwo = {
      batchId: 0,
      txs: [tx],
      batchProofs: {
        accountProofs: [accountProofs],
        pdaProof: [alicePDAProof]
      }
    }
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    falseBatchTwo.batchId = Number(batchId) - 1;
  });

  it("dispute batch false 3rd batch(Tx amount 0)", async function () {
    await rollupCoreInstance.disputeBatch(
      falseBatchTwo.batchId,
      falseBatchTwo.txs,
      falseBatchTwo.batchProofs,
    );
    
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    let batchMarker = await rollupCoreInstance.invalidBatchMarker();
    assert.equal(batchMarker, "0", "batchMarker is not zero");
    assert.equal(batchId -1 , falseBatchTwo.batchId - 1, "batchId doesnt match");
    Alice.Amount += falseBatchTwo.txs[0].amount;
    Bob.Amount -= falseBatchTwo.txs[0].amount;
    Alice.nonce--;
  })

  
  it("Registring new token", async function () {
    await TestToken.new().then(async (instance: any) => {
      let testToken2Instance = instance;
      console.log("testToken2Instance.address: ", testToken2Instance.address)
      await tokenRegistryInstance.requestTokenRegistration(testToken2Instance.address, {
        from: wallets[0].getAddressString(),
      });
      await tokenRegistryInstance.finaliseTokenRegistration(testToken2Instance.address, {
        from: wallets[0].getAddressString(),
      });
    });
    var tokenAddress = await tokenRegistryInstance.registeredTokens(2);
    // TODO
  })

  it("submit new batch 5nd", async function () {
    var AliceAccountLeaf = await utils.createLeaf(Alice);
    var BobAccountLeaf = await utils.createLeaf(Bob);

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();

    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(Alice.Pubkey),
      "2",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var tx: Transaction = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: 2, // error
      amount: tranferAmount,
      txType: 1,
      nonce: 2
    };

    tx.signature = await utils.signTx(tx, wallets[0]);

    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);
    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: Alice.AccID,
          tokenType: Alice.TokenType,
          balance: Alice.Amount,
          nonce: Alice.nonce,
        },
      },
      siblings: AliceAccountSiblings,
    };

    Alice.Amount -= Number(tx.amount);
    Alice.nonce++;

    var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      UpdatedAliceAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";
    var isBobValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      BobAccountPath,
      BobAccountSiblings
    );

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: Bob.AccID,
          tokenType: Bob.TokenType,
          balance: Bob.Amount,
          nonce: Bob.nonce,
        },
      },
      siblings: BobAccountSiblings,
    };

    Bob.Amount += Number(tx.amount);
    var accountProofs = {
      from: AliceAccountMP,
      to: BobAccountMP,
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );

    var falseResult = await utils.falseProcessTx(
      tx,
      accountProofs
    );
    assert.equal(result[3], ErrorCode.BadFromTokenType, "False ErrorId. It should be `4`")
    await utils.compressAndSubmitBatch(tx, falseResult)

    falseBatchFive = {
      batchId: 0,
      txs: [tx],
      batchProofs: {
        accountProofs: [accountProofs],
        pdaProof: [alicePDAProof]
      }
    }
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    falseBatchFive.batchId = Number(batchId) - 1;
  });
  it("dispute batch false 5th batch(From Token Type)", async function () {
    await rollupCoreInstance.disputeBatch(
      falseBatchFive.batchId,
      falseBatchFive.txs,
      falseBatchFive.batchProofs,
    );
    
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    let batchMarker = await rollupCoreInstance.invalidBatchMarker();
    assert.equal(batchMarker, "0", "batchMarker is not zero");
    assert.equal(batchId -1 , falseBatchFive.batchId - 1, "batchId doesnt match");
    Alice.Amount += falseBatchFive.txs[0].amount;
    Bob.Amount -= falseBatchFive.txs[0].amount;
    Alice.nonce--;
  })


  it("submit new batch 6nd(False Batch)", async function () {
    var AliceAccountLeaf = await utils.createLeaf(Alice);
    var BobAccountLeaf = await utils.createLeaf(Bob);

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();

    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(Alice.Pubkey),
      "2",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var bobPDAProof = {
      _pda: {
        pathToPubkey: "2",
        pubkey_leaf: { pubkey: Bob.Pubkey },
      },
      siblings: BobPDAsiblings,
    };

    var tx: Transaction = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: 3, // false type
      amount: tranferAmount,
      txType: 1,
      nonce: 2
    };
    tx.signature = await utils.signTx(tx, wallets[0]);
    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);
    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: Alice.AccID,
          tokenType: Alice.TokenType,
          balance: Alice.Amount,
          nonce: Alice.nonce,
        },
      },
      siblings: AliceAccountSiblings,
    };

    Alice.Amount -= Number(tx.amount);
    Alice.nonce++;

    var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      UpdatedAliceAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";
    var isBobValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      BobAccountPath,
      BobAccountSiblings
    );

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: Bob.AccID,
          tokenType: Bob.TokenType,
          balance: Bob.Amount,
          nonce: Bob.nonce,
        },
      },
      siblings: BobAccountSiblings,
    };

    Bob.Amount += Number(tx.amount);
    var accountProofs = {
      from: AliceAccountMP,
      to: BobAccountMP,
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );

    var falseResult = await utils.falseProcessTx(
      tx,
      accountProofs
    );
    assert.equal(result[3], 1, "Wrong ErrorId")
    var compressedTx = await utils.compressTx(
      tx.fromIndex,
      tx.toIndex,
      tx.nonce,
      tx.amount,
      tx.tokenType,
      tx.signature
    );

    let compressedTxs: string[] = [];
    compressedTxs.push(compressedTx);
    console.log("compressedTx: " + JSON.stringify(compressedTxs));

    // submit batch for that transactions
    await rollupCoreInstance.submitBatch(
      compressedTxs,
      falseResult,
      { value: ethers.utils.parseEther("32").toString() }
    );

    falseBatchComb = {
      batchId: 0,
      txs: [tx],
      batchProofs: {
        accountProofs: [accountProofs],
        pdaProof: [alicePDAProof]
      }
    }
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    falseBatchComb.batchId = Number(batchId) - 1;
  });

  it("submit new batch 7th(false batch)", async function () {
    var AliceAccountLeaf = await utils.createLeaf(Alice);
    var BobAccountLeaf = await utils.createLeaf(Bob);

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();

    var isValid = await MTutilsInstance.verifyLeaf(
      accountRoot,
      utils.PubKeyHash(Alice.Pubkey),
      "2",
      AlicePDAsiblings
    );
    assert.equal(isValid, true, "pda proof wrong");

    var tx: Transaction = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: Alice.TokenType,
      amount: 0, // An invalid amount
      txType: 1,
      nonce: 2
    };
    tx.signature = await utils.signTx(tx, wallets[0]);

    // alice balance tree merkle proof
    var AliceAccountSiblings: Array<string> = [
      BobAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = AliceAccountLeaf;
    var AliceAccountPath: string = "2";
    var isValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      AliceAccountPath,
      AliceAccountSiblings
    );
    expect(isValid).to.be.deep.eq(true);
    var AliceAccountMP = {
      accountIP: {
        pathToAccount: AliceAccountPath,
        account: {
          ID: Alice.AccID,
          tokenType: Alice.TokenType,
          balance: Alice.Amount,
          nonce: Alice.nonce,
        },
      },
      siblings: AliceAccountSiblings,
    };

    Alice.Amount -= Number(tx.amount);
    Alice.nonce++;

    var UpdatedAliceAccountLeaf = await utils.createLeaf(Alice);

    // bob balance tree merkle proof
    var BobAccountSiblings: Array<string> = [
      UpdatedAliceAccountLeaf,
      utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
      zeroHashes[2],
      zeroHashes[3],
    ];
    var leaf = BobAccountLeaf;
    var BobAccountPath: string = "3";
    var isBobValid = await MTutilsInstance.verifyLeaf(
      currentRoot,
      leaf,
      BobAccountPath,
      BobAccountSiblings
    );

    var BobAccountMP = {
      accountIP: {
        pathToAccount: BobAccountPath,
        account: {
          ID: Bob.AccID,
          tokenType: Bob.TokenType,
          balance: Bob.Amount,
          nonce: Bob.nonce,
        },
      },
      siblings: BobAccountSiblings,
    };

    Bob.Amount += Number(tx.amount);
    var accountProofs = {
      from: AliceAccountMP,
      to: BobAccountMP,
    };

    // process transaction validity with process tx
    var result = await rollupCoreInstance.processTx(
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );

    var falseResult = await utils.falseProcessTx(
      tx,
      accountProofs
    );
    assert.equal(result[3], ErrorCode.InvalidTokenAmount, "false ErrorId. it should be `2`");
    await utils.compressAndSubmitBatch(tx, falseResult)

    falseBatchComb.txs.push(tx);
    falseBatchComb.batchProofs.accountProofs.push(accountProofs);
    falseBatchComb.batchProofs.pdaProof.push(alicePDAProof);
  });

  it("dispute batch false Combo batch", async function () {
    await rollupCoreInstance.disputeBatch(
      falseBatchComb.batchId,
      falseBatchComb.txs,
      falseBatchComb.batchProofs,
    );
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    let batchMarker = await rollupCoreInstance.invalidBatchMarker();
    assert.equal(batchMarker, "0", "batchMarker is not zero");
    assert.equal(batchId -1 , falseBatchComb.batchId - 1, "batchId doesnt match");
    Alice.Amount += falseBatchComb.txs[0].amount;
    Alice.Amount += falseBatchComb.txs[1].amount;
    Bob.Amount -= falseBatchComb.txs[0].amount;
    Bob.Amount -= falseBatchComb.txs[1].amount;
    Alice.nonce--;
    Alice.nonce--;
  })

});
