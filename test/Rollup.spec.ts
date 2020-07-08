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

  let aa: any;
  let bb: any;
  let cc: any;
  let dd: any;

  let coordinator_leaves: any;
  let coordinatorPubkeyHash: any;
  let maxSize: any;

  let falseBatchOne: any;

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
  });

  // test if we are able to create append a leaf
  it("make a deposit of 2 accounts", async function () {
    await tokenRegistryInstance.requestTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString(),
    });
    await tokenRegistryInstance.finaliseTokenRegistration(testToken.address, {
      from: wallets[0].getAddressString(),
    });
    var coordinator_leaves = await RollupUtilsInstance.GetGenesisLeaves();
    await testToken.approve(
      depositManagerInstance.address,
      web3.utils.toWei("1"),
      {
        from: wallets[0].getAddressString(),
      }
    );

    
    // var maxSize = 4;

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
    console.log("Alice: ", Alice)
    console.log("Bob: ", Bob)
    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

    aa = AliceAccountLeaf;
    bb = BobAccountLeaf;

    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    var accountRoot = await IMTInstance.getTreeRoot();
    var zeroHashes: any = await utils.defaultHashes(maxSize);

    var AlicePDAsiblings = [
      utils.PubKeyHash(Bob.Pubkey),
      utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
      zeroHashes[2],
      zeroHashes[3],
    ];

    var BobPDAsiblings = [
      utils.PubKeyHash(Alice.Pubkey),
      utils.getParentLeaf(
        coordinatorPubkeyHash,
        utils.PubKeyHash(Alice.Pubkey)
      ),
      zeroHashes[2],
      zeroHashes[3],
    ];

    var alicePDAProof = {
      _pda: {
        pathToPubkey: "2",
        pubkey_leaf: { pubkey: Alice.Pubkey },
      },
      siblings: AlicePDAsiblings,
    };

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
      tokenType: Alice.TokenType,
      amount: tranferAmount,
      txType: 1,
      nonce: 1,
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
    cc = UpdatedAliceAccountLeaf;
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

    console.log("result from processTx: " + JSON.stringify(result));

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
      result[0],
      { value: ethers.utils.parseEther("32").toString() }
    );
    console.log("result[0]: ", result[0])
  });

  it("submit new batch 2nd", async function () {
    console.log("Alice: ", Alice)
    console.log("Bob: ", Bob)

    var AliceAccountLeaf = await createLeaf(Alice);
    var BobAccountLeaf = await createLeaf(Bob);

    console.log(cc == AliceAccountLeaf)
    console.log(cc)
    console.log(AliceAccountLeaf)

    console.log(bb == BobAccountLeaf)
    console.log(bb)
    console.log(BobAccountLeaf)
    // make a transfer between alice and bob's account
    var tranferAmount = 1;
    // prepare data for process Tx
    var currentRoot = await rollupCoreInstance.getLatestBalanceTreeRoot();
    console.log("currentRoot: ", currentRoot)
    var accountRoot = await IMTInstance.getTreeRoot();
    var zeroHashes: any = await utils.defaultHashes(maxSize);

    var AlicePDAsiblings = [
      utils.PubKeyHash(Bob.Pubkey),
      utils.getParentLeaf(coordinatorPubkeyHash, coordinatorPubkeyHash),
      zeroHashes[2],
      zeroHashes[3],
    ];

    var BobPDAsiblings = [
      utils.PubKeyHash(Alice.Pubkey),
      utils.getParentLeaf(
        coordinatorPubkeyHash,
        utils.PubKeyHash(Alice.Pubkey)
      ),
      zeroHashes[2],
      zeroHashes[3],
    ];

    var alicePDAProof = {
      _pda: {
        pathToPubkey: "2",
        pubkey_leaf: { pubkey: Alice.Pubkey },
      },
      siblings: AlicePDAsiblings,
    };

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
      tokenType: 2,
      amount: tranferAmount,
      txType: 1,
      nonce: 2,
      signature:
        "0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563",
    };
    console.log(tx)
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
    console.log(falseBatchOne)
    // console.log("Alice: ",Alice)
    // console.log("Bob: ", Bob)
  });
  it("dispute batch false batch(Token Type)", async function () {
    let rollupCoreInstance = await RollupCore.deployed();
    // console.log("falseBatchOne.batchId: ", falseBatchOne.batchId)
    // console.log("falseBatchOne.txs: ", falseBatchOne.txs)
    // console.log("falseBatchOne.accountProofs: ", falseBatchOne.batchProofs.accountProofs)
    // console.log("falseBatchOne.pdaProof: ", falseBatchOne.batchProofs.pdaProof)

    let x = await rollupCoreInstance.batches(falseBatchOne.batchId)
    // console.log(x)
    await rollupCoreInstance.disputeBatch(
      falseBatchOne.batchId,
      falseBatchOne.txs,
      falseBatchOne.batchProofs,
    );
    // falseBatchOne = {
    //   batchId: 0,
    //   txs: [tx],
    //   from_proofs: [AliceAccountMP],
    //   to_proofs: [BobAccountMP],
    //   _pda_proof: [alicePDAProof]
    // }
    
    
    let batchId = await rollupCoreInstance.numOfBatchesSubmitted();
    let batchMarker = await rollupCoreInstance.invalidBatchMarker();
    // console.log("batchId: ", Number(batchId))
    // console.log("batchMarker: ", Number(batchMarker))
    let y = await rollupCoreInstance.batches(Number(batchId) - 1)
    // console.log(y)
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