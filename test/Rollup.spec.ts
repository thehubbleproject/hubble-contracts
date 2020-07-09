import * as utils from "../scripts/helpers/utils";
import { ethers } from "ethers";
import * as walletHelper from "../scripts/helpers/wallet";
const RollupCore = artifacts.require("Rollup");
const TestToken = artifacts.require("TestToken");
const DepositManager = artifacts.require("DepositManager");
const IMT = artifacts.require("IncrementalTree");
const RollupUtils = artifacts.require("RollupUtils");
const EcVerify = artifacts.require("ECVerify");
const FraudProof = artifacts.require("FraudProof");
import * as ethUtils from "ethereumjs-util";

contract("Rollup", async function (accounts) {
  var wallets: any;

  let depositManagerInstance: any;
  let testTokenInstance: any;
  let fraudProofInstance: any;
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

    let NO_ERR = 0;
    let ERR_TOKEN_ADDR_INVAILD = 1; // account doesnt hold token type in the tx
    let ERR_TOKEN_AMT_INVAILD = 2; // tx amount is less than zero
    let ERR_TOKEN_NOT_ENOUGH_BAL = 3; // leaf doesnt has enough balance
    let ERR_FROM_TOKEN_TYPE = 4; // from account doesnt hold the token type in the tx
    let ERR_TO_TOKEN_TYPE = 5; // to account doesnt hold the token type in the tx

  before(async function () {
    wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10);

    fraudProofInstance = await FraudProof.deployed();
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
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

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

    var tx = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: Alice.TokenType,
      amount: tranferAmount,
      txType: 1,
      nonce: 1,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };

    tx.signature = await signTx(tx, wallets);

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

    var UpdatedAliceAccountLeaf = await createLeaf(Alice);
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
    await compressAndSubmitBatch(tx, result[0])

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
    assert.equal(batchId -1 , falseBatchZero.batchId, "dispute shouldnt happen");
  })

  it("submit new batch 2nd(False Batch)", async function () {
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

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

    var tx = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      // tokenType: Alice.TokenType,
      tokenType: 2, // false token type (Token not valid)
      amount: tranferAmount,
      txType: 1,
      nonce: 2,
      signature:
        "0x1ad4773ace8ee65b8f1d94a3ca7adba51ee2ca0bdb550907715b3b65f1e3ad9f69e610383dc9ceb8a50c882da4b1b98b96500bdf308c1bdce2187cb23b7d736f1b",
    };
    tx.signature = await signTx(tx, wallets);

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

    var UpdatedAliceAccountLeaf = await createLeaf(Alice);

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

    var falseResult = await falseProcessTx(
      fraudProofInstance,
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );
    console.log("result from falseProcessTx: " + falseResult);
    console.log("result from processTx: " + JSON.stringify(result));

    assert.equal(result[3], ERR_TOKEN_ADDR_INVAILD, "False error ID. It should be `1`")
    await compressAndSubmitBatch(tx, falseResult)

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
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

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

    var tx = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: Alice.TokenType,
      amount: 0, // Error
      txType: 1,
      nonce: 2,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };
    tx.signature = await signTx(tx, wallets);

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

    var UpdatedAliceAccountLeaf = await createLeaf(Alice);

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

    var falseResult = await falseProcessTx(
      fraudProofInstance,
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );
    console.log("result from falseProcessTx: " + falseResult);
    console.log("result from processTx: " + JSON.stringify(result));
    
    assert.equal(result[3], ERR_TOKEN_AMT_INVAILD, "false Error Id. It should be `2`.");

    await compressAndSubmitBatch(tx, falseResult)

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

  // it("submit new batch 4nd", async function () {
  //   console.log("Alice: ", Alice)
  //   console.log("Bob: ", Bob)

  //   var AliceAccountLeaf = await createLeaf(Alice);
  //   var BobAccountLeaf = await createLeaf(Bob);

  //   console.log(cc == AliceAccountLeaf)
  //   // console.log(cc)
  //   // console.log(AliceAccountLeaf)

  //   // console.log(bb == BobAccountLeaf)
  //   // console.log(bb)
  //   // console.log(BobAccountLeaf)
  //   // make a transfer between alice and bob's account
  //   var tranferAmount = Alice.Amount + 1;
  //   // prepare data for process Tx
  //   var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
  //   // console.log("currentRoot: ", currentRoot)
  //   var accountRoot = await IMTInstance.getTreeRoot();
  //   var zeroHashes: any = await utils.defaultHashes(maxSize);

  //   var AlicePDAsiblings = [
  //     utils.PubKeyHash(Bob.Pubkey),
  //     utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
  //     zeroHashes[2],
  //     zeroHashes[3],
  //   ];

  //   var BobPDAsiblings = [
  //     utils.PubKeyHash(Alice.Pubkey),
  //     utils.getParentLeaf(
  //       coordinatorPubkeyHash,
  //       utils.PubKeyHash(Alice.Pubkey)
  //     ),
  //     zeroHashes[2],
  //     zeroHashes[3],
  //   ];

  //   var alicePDAProof = {
  //     _pda: {
  //       pathToPubkey: "2",
  //       pubkey_leaf: { pubkey: Alice.Pubkey },
  //     },
  //     siblings: AlicePDAsiblings,
  //   };

  //   var isValid = await MTutilsInstance.verifyLeaf(
  //     accountRoot,
  //     utils.PubKeyHash(Alice.Pubkey),
  //     "2",
  //     AlicePDAsiblings
  //   );
  //   assert.equal(isValid, true, "pda proof wrong");

  //   var bobPDAProof = {
  //     _pda: {
  //       pathToPubkey: "2",
  //       pubkey_leaf: { pubkey: Bob.Pubkey },
  //     },
  //     siblings: BobPDAsiblings,
  //   };

  //   var tx = {
  //     fromIndex: Alice.AccID,
  //     toIndex: Bob.AccID,
  //     tokenType: Alice.TokenType,
  //     amount: tranferAmount,
  //     txType: 1,
  //     nonce: 2,
  //     signature:
  //       "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
  //   };
  //   console.log(tx)
  //   var dataToSign = await RollupUtilsInstance.getTxSignBytes(
  //     tx.fromIndex,
  //     tx.toIndex,
  //     tx.tokenType,
  //     tx.txType,
  //     tx.nonce,
  //     tx.amount
  //   );

  //   const h = ethUtils.toBuffer(dataToSign);
  //   var signature = ethUtils.ecsign(h, wallets[0].getPrivateKey());
  //   tx.signature = ethUtils.toRpcSig(signature.v, signature.r, signature.s);

  //   // alice balance tree merkle proof
  //   var AliceAccountSiblings: Array<string> = [
  //     BobAccountLeaf,
  //     utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
  //     zeroHashes[2],
  //     zeroHashes[3],
  //   ];
  //   var leaf = AliceAccountLeaf;
  //   var AliceAccountPath: string = "2";
  //   var isValid = await MTutilsInstance.verifyLeaf(
  //     currentRoot,
  //     leaf,
  //     AliceAccountPath,
  //     AliceAccountSiblings
  //   );
  //   expect(isValid).to.be.deep.eq(true);
  //   var AliceAccountMP = {
  //     accountIP: {
  //       pathToAccount: AliceAccountPath,
  //       account: {
  //         ID: Alice.AccID,
  //         tokenType: Alice.TokenType,
  //         balance: Alice.Amount,
  //         nonce: Alice.nonce,
  //       },
  //     },
  //     siblings: AliceAccountSiblings,
  //   };

  //   Alice.Amount -= Number(1);
  //   Alice.nonce++;

  //   var UpdatedAliceAccountLeaf = await createLeaf(Alice);

  //   // bob balance tree merkle proof
  //   var BobAccountSiblings: Array<string> = [
  //     UpdatedAliceAccountLeaf,
  //     utils.getParentLeaf(coordinator_leaves[0], coordinator_leaves[1]),
  //     zeroHashes[2],
  //     zeroHashes[3],
  //   ];
  //   var leaf = BobAccountLeaf;
  //   var BobAccountPath: string = "3";
  //   var isBobValid = await MTutilsInstance.verifyLeaf(
  //     currentRoot,
  //     leaf,
  //     BobAccountPath,
  //     BobAccountSiblings
  //   );

  //   var BobAccountMP = {
  //     accountIP: {
  //       pathToAccount: BobAccountPath,
  //       account: {
  //         ID: Bob.AccID,
  //         tokenType: Bob.TokenType,
  //         balance: Bob.Amount,
  //         nonce: Bob.nonce,
  //       },
  //     },
  //     siblings: BobAccountSiblings,
  //   };

  //   Bob.Amount += Number(tx.amount);
  //   var accountProofs = {
  //     from: AliceAccountMP,
  //     to: BobAccountMP,
  //   };

  //   // process transaction validity with process tx
  //   var result = await rollupCoreInstance.processTx(
  //     currentRoot,
  //     accountRoot,
  //     tx,
  //     alicePDAProof,
  //     accountProofs
  //   );

  //   var falseResult = await falseProcessTx(
  //     fraudProofInstance,
  //     currentRoot,
  //     accountRoot,
  //     tx,
  //     alicePDAProof,
  //     accountProofs
  //   );
  //   console.log("result from falseProcessTx: " + falseResult);

  //   console.log("result from processTx: " + JSON.stringify(result));

  //   var compressedTx = await utils.compressTx(
  //     tx.fromIndex,
  //     tx.toIndex,
  //     tx.nonce,
  //     tx.amount,
  //     tx.tokenType,
  //     tx.signature
  //   );

  //   let compressedTxs: string[] = [];
  //   compressedTxs.push(compressedTx);
  //   console.log("compressedTx: " + JSON.stringify(compressedTxs));

  //   // submit batch for that transactions
  //   await rollupCoreInstance.submitBatch(
  //     compressedTxs,
  //     falseResult,
  //     { value: ethers.utils.parseEther("32").toString() }
  //   );

  //   falseBatchThree = {
  //     batchId: 0,
  //     txs: [tx],
  //     batchProofs: {
  //       accountProofs: [accountProofs],
  //       pdaProof: [alicePDAProof]
  //     }
  //   }
    
  //   let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
  //   falseBatchThree.batchId = Number(batchId) - 1;
  //   console.log(falseBatchThree)
  // });
  // it("dispute batch false batch(Tx amount 0)", async function () {
  //   await rollupCoreInstance.disputeBatch(
  //     falseBatchThree.batchId,
  //     falseBatchThree.txs,
  //     falseBatchThree.batchProofs,
  //   );
    
    
  //   let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
  //   let batchMarker = await rollupCoreInstance.invalidBatchMarker();
  //   assert.equal(batchMarker, "0", "batchMarker is not zero");
  //   assert.equal(batchId -1 , falseBatchThree.batchId - 1, "batchId doesnt match");
  //   Alice.Amount += 1;
  //   Bob.Amount -= falseBatchOne.txs[0].amount;
  //   Alice.nonce--;
  // })
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
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

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

    var tx = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: 2, // error
      amount: tranferAmount,
      txType: 1,
      nonce: 2,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };
    var dataToSign = await RollupUtilsInstance.getTxSignBytes(
      tx.fromIndex,
      tx.toIndex,
      tx.tokenType,
      tx.txType,
      tx.nonce,
      tx.amount
    );

    tx.signature = await signTx(tx, wallets);

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

    var UpdatedAliceAccountLeaf = await createLeaf(Alice);

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

    var falseResult = await falseProcessTx(
      fraudProofInstance,
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );
    console.log("result from falseProcessTx: " + falseResult);
    console.log("result from processTx: " + JSON.stringify(result));
    
    assert.equal(result[3], ERR_FROM_TOKEN_TYPE, "False ErrorId. It should be `4`")
    await compressAndSubmitBatch(tx, falseResult)

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
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

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

    var tx = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      // tokenType: Alice.TokenType,
      tokenType: 3, // false type
      amount: tranferAmount,
      txType: 1,
      nonce: 2,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };
    var dataToSign = await RollupUtilsInstance.getTxSignBytes(
      tx.fromIndex,
      tx.toIndex,
      tx.tokenType,
      tx.txType,
      tx.nonce,
      tx.amount
    );

    const h = ethUtils.toBuffer(dataToSign);
    var signature = ethUtils.ecsign(h, wallets[0].getPrivateKey());
    tx.signature = ethUtils.toRpcSig(signature.v, signature.r, signature.s);

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

    var UpdatedAliceAccountLeaf = await createLeaf(Alice);

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

    var falseResult = await falseProcessTx(
      fraudProofInstance,
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );
    console.log("result from falseProcessTx: " + falseResult);
    console.log("result from processTx: " + JSON.stringify(result));

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
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

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

    var tx = {
      fromIndex: Alice.AccID,
      toIndex: Bob.AccID,
      tokenType: Alice.TokenType,
      amount: 0, // Error
      txType: 1,
      nonce: 2,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };
    tx.signature = await signTx(tx, wallets);

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

    var UpdatedAliceAccountLeaf = await createLeaf(Alice);

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

    var falseResult = await falseProcessTx(
      fraudProofInstance,
      currentRoot,
      accountRoot,
      tx,
      alicePDAProof,
      accountProofs
    );
    console.log("result from falseProcessTx: " + falseResult);
    console.log("result from processTx: " + JSON.stringify(result));
    
    assert.equal(result[3], ERR_TOKEN_AMT_INVAILD, "false ErrorId. it should be `2`");
    await compressAndSubmitBatch(tx, falseResult)

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

async function falseProcessTx(
  FraudProofInstance: any,
  currentRoot: any,
  accountRoot: any,
  _tx: any,
  alicePDAProof: any,
  accountProofs: any
) {
  var _from_merkle_proof = accountProofs.from;
  var _to_merkle_proof = accountProofs.to;
  let new_from_txApply = await FraudProofInstance.ApplyTx(
    _from_merkle_proof,
    _tx
  );

  let new_to_txApply = await FraudProofInstance.ApplyTx(
    _to_merkle_proof,
    _tx
  );
  return new_to_txApply.newRoot;
}

async function createLeaf(account: any) {
  return await utils.CreateAccountLeaf(
    account.AccID,
    account.Amount,
    account.nonce,
    account.TokenType
  );
}

async function signTx(tx: any, wallets: any) {
  let RollupUtilsInstance = await RollupUtils.deployed()
  var dataToSign = await RollupUtilsInstance.getTxSignBytes(
    tx.fromIndex,
    tx.toIndex,
    tx.tokenType,
    tx.txType,
    tx.nonce,
    tx.amount
  );

  const h = ethUtils.toBuffer(dataToSign);
  var signature = ethUtils.ecsign(h, wallets[0].getPrivateKey());
  return ethUtils.toRpcSig(signature.v, signature.r, signature.s);
}

async function compressAndSubmitBatch(tx: any, newRoot: any) {
  let rollupCoreInstance = await RollupCore.deployed()
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
    newRoot,
    { value: ethers.utils.parseEther("32").toString() }
  );
}