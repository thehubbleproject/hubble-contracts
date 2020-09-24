import { deployAll } from "../ts/deploy";
import { TESTING_PARAMS } from "../ts/constants";
import { ethers } from "@nomiclabs/buidler";
import { StateTree } from "../ts/stateTree";
import { AccountRegistry } from "../ts/accountTree";
import { State } from "../ts/state";
import { serialize, TxTransfer } from "../ts/tx";
import * as mcl from "../ts/mcl";
import { allContracts } from "../ts/allContractsInterfaces";
import { assert } from "chai";
import { TransferBatch, TransferCommitment } from "../ts/commitments";
import { USDT } from "../ts/decimal";

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

        Bob = State.new(-1, tokenID, initialBalance, 0);
        Bob.setStateID(1);
        Bob.newKeyPair();
        Bob.pubkeyIndex = await registry.register(Bob.encodePubkey());

        stateTree.createState(Alice);
        stateTree.createState(Bob);

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

    it("submit a batch and dispute", async function() {});
});
