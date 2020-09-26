import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { serialize, TxCreate2Transfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { TransferBatch, TransferCommitment } from "../ts/commitments";
import { USDT } from "../ts/decimal";
import { Rollup } from "../types/ethers-contracts/Rollup";
const DOMAIN =
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

describe("Rollup", async function() {
    const tokenID = 1;
    let Alice: State;
    let Bob: State;
    let contracts: allContracts;
    let stateTree: StateTree;
    let registry: AccountRegistry;
    let initialBatch: TransferBatch;
    before(async function() {
        await mcl.init();
        mcl.setDomainHex(DOMAIN);
    });

    beforeEach(async function() {
        const accounts = await ethers.getSigners();
        contracts = await deployAll(accounts[0], TESTING_PARAMS);
        stateTree = new StateTree(TESTING_PARAMS.MAX_DEPTH);
        const registryContract = contracts.blsAccountRegistry;
        registry = await AccountRegistry.new(registryContract);
        const initialBalance = USDT.castInt(55.6);

        Alice = State.new(-1, tokenID, initialBalance, 0);
        Alice.setStateID(0);
        Alice.newKeyPair();
        Alice.pubkeyIndex = await registry.register(Alice.encodePubkey());

        stateTree.createState(Alice);

        const accountRoot = await registry.root();

        const initialCommitment = TransferCommitment.new(
            stateTree.root,
            accountRoot
        );
        initialBatch = initialCommitment.toBatch();
        await initialBatch.submit(
            contracts.rollup,
            TESTING_PARAMS.STAKE_AMOUNT
        );
    });

    it("tranfer to pubkey", async function() {
        const initialBalance = USDT.castInt(55.6);
        const RollupUtilsInstance = contracts.rollupUtils;
        Bob = State.new(-1, tokenID, initialBalance, 0);
        Bob.newKeyPair();
        const amount = USDT.castInt(20.01);
        const fee = USDT.castInt(1.001);

        const tx = new TxCreate2Transfer(0, 0, 0, amount, fee, 1, USDT);
        let encodedTx = await RollupUtilsInstance[
            "BytesFromTx(uint256,uint256[4],uint256[4],uint256,uint256,uint256,uint256)"
        ](
            1,
            Alice.encodePubkey(),
            Bob.encodePubkey(),
            tx.toPubkeyIndex,
            tx.nonce,
            tx.amount,
            tx.fee
        );

        Bob.setStateID(1);
        Bob.pubkeyIndex = await registry.register(Bob.encodePubkey());

        encodedTx = await RollupUtilsInstance.Create2PubkeyToIndex(
            encodedTx,
            Alice.stateID,
            Bob.stateID,
            Bob.pubkeyIndex
        );

        stateTree.createState(Bob);
    });
});
