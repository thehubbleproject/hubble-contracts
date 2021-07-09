import { BigNumber } from "@ethersproject/bignumber";
import chai, { assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import { OffchainTx } from "../../ts/client/features/interface";
import { TransferOffchainTx } from "../../ts/client/features/transfer";
import {
    StateMemoryEngine,
    StateStorageEngine
} from "../../ts/client/storageEngine";
import { MultiTokenPool } from "../../ts/client/txPool";
import { TESTING_PARAMS as params } from "../../ts/constants";
import {
    PoolEmptyError,
    PoolFullError,
    TokenNotConfiguredError,
    TokenPoolEmpty
} from "../../ts/exceptions";
import { State } from "../../ts/state";

chai.use(chaiAsPromised);

const tokenID1 = 0;
const tokenID1BN = BigNumber.from(tokenID1);
const tokenID2 = 1337;
const tokenID2BN = BigNumber.from(tokenID2);
const tokenIDs = [tokenID1, tokenID2];

const feeReceiver1 = 0;
const feeReceiver2 = 1;

const feeReceivers = [
    {
        tokenID: tokenID1,
        stateID: feeReceiver1
    },
    {
        tokenID: tokenID2,
        stateID: feeReceiver2
    }
];

const txFactory = (fromIndex: number, fee: number): OffchainTx => {
    return new TransferOffchainTx(
        BigNumber.from(fromIndex),
        BigNumber.from(-1),
        BigNumber.from(-2),
        BigNumber.from(fee),
        BigNumber.from(-3)
    );
};

const highTokenToNum = ({
    tokenID,
    feeReceiverID
}: {
    tokenID: BigNumber;
    feeReceiverID: BigNumber;
}): { tokenID: number; feeReceiverID: number } => ({
    tokenID: tokenID.toNumber(),
    feeReceiverID: feeReceiverID.toNumber()
});

describe("MultiTokenPool", () => {
    let state: StateStorageEngine;
    let pool: MultiTokenPool<OffchainTx>;

    beforeEach(function() {
        state = new StateMemoryEngine(params.MAX_DEPTH);
        pool = new MultiTokenPool(state, feeReceivers);
    });

    describe("size", () => {
        it("returns 0 if tokenID does not exist", function() {
            assert.equal(pool.size(BigNumber.from(42)), 0);
        });
    });

    describe("push", () => {
        it("fails if pool is full", async function() {
            const smolPool = new MultiTokenPool<OffchainTx>(
                state,
                feeReceivers,
                0
            );
            const tx = txFactory(0, 0);
            await assert.isRejected(smolPool.push(tx), PoolFullError);
        });

        it("fails if token is not configured", async function() {
            const fromIndex = 0;
            const missingTokenID = 2;
            const s = State.new(missingTokenID, 2, 0, 0);
            await state.create(fromIndex, s);
            const tx = txFactory(fromIndex, 1);
            await assert.isRejected(pool.push(tx), TokenNotConfiguredError);
        });
    });

    describe("pop", () => {
        it("fails if token is not configured", function() {
            assert.throws(() => {
                pool.pop(BigNumber.from(42));
            }, TokenNotConfiguredError);
        });

        it("fails if token queue is empty", function() {
            assert.throws(() => {
                pool.pop(tokenID1BN);
            }, TokenPoolEmpty);
        });
    });

    describe("getHighestValueToken", () => {
        it("fails if pool is empty", async function() {
            await assert.isRejected(
                pool.getHighestValueToken(),
                PoolEmptyError
            );
        });
    });

    describe("lifecycle", () => {
        it("correctly manages trasnactions being added and removed", async function() {
            // Setup states for users and tokens
            const numStates = 6;
            const stateIDs = [];
            for (let stateID = 0; stateID < numStates; stateID++) {
                const tokenIdx = stateID % tokenIDs.length;
                const s = State.new(-1, tokenIDs[tokenIdx], -1, -1);
                await state.create(stateID, s);
                stateIDs.push(stateID);
            }
            await state.commit();

            const [
                _feeReciever1,
                _feeReciever2,
                user1Token1,
                user1Token2,
                user2Token1,
                user2Token2
            ] = stateIDs;

            assert.equal(pool.size(), 0);
            assert.equal(pool.size(tokenID1BN), 0);
            assert.equal(pool.size(tokenID2BN), 0);

            // First tx added and prioritized
            const token1Tx1 = txFactory(user1Token1, 1);
            await pool.push(token1Tx1);

            assert.equal(pool.size(), 1);
            assert.equal(pool.size(tokenID1BN), 1);
            assert.equal(pool.size(tokenID2BN), 0);
            const highToken1 = highTokenToNum(
                await pool.getHighestValueToken()
            );
            assert.deepEqual(highToken1, {
                tokenID: tokenID1,
                feeReceiverID: feeReceiver1
            });

            // Second tx added and prioritized due to higher fee
            const token2Tx1 = txFactory(user1Token2, 2);
            await pool.push(token2Tx1);

            assert.equal(pool.size(), 2);
            assert.equal(pool.size(tokenID1BN), 1);
            assert.equal(pool.size(tokenID2BN), 1);
            const highToken2 = highTokenToNum(
                await pool.getHighestValueToken()
            );
            assert.deepEqual(highToken2, {
                tokenID: tokenID2,
                feeReceiverID: feeReceiver2
            });

            // tx 3 & 4 added, token1 prioritized due to higher combined fee
            const token1Tx2 = txFactory(user2Token1, 3);
            await pool.push(token1Tx2);

            const token2Tx2 = txFactory(user2Token2, 1);
            await pool.push(token2Tx2);

            assert.equal(pool.size(), 4);
            assert.equal(pool.size(tokenID1BN), 2);
            assert.equal(pool.size(tokenID2BN), 2);
            const highToken3 = highTokenToNum(
                await pool.getHighestValueToken()
            );
            assert.deepEqual(highToken3, {
                tokenID: tokenID1,
                feeReceiverID: feeReceiver1
            });

            // TODO More testing with pop
        });
    });
});
