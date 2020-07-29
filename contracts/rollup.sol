pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { Types } from "./libs/Types.sol";
import { Tx } from "./libs/Tx.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ECVerify } from "./libs/ECVerify.sol";
import { IncrementalTree } from "./IncrementalTree.sol";
import { Logger } from "./logger.sol";
import { POB } from "./POB.sol";
import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Governance } from "./Governance.sol";
import { DepositManager } from "./DepositManager.sol";

interface IRollupReddit {
    function processBatch(
        bytes32 initialStateRoot,
        bytes32 accountsRoot,
        bytes calldata _txs,
        bytes[] calldata signatures,
        Types.BatchValidationProofs calldata batchProofs,
        bytes32 expectedTxRoot,
        Types.Usage batchType
    )
        external
        view
        returns (
            bytes32,
            bytes32,
            bool
        );
}

contract RollupSetup {
    using SafeMath for uint256;
    using BytesLib for bytes;
    using ECVerify for bytes32;
    using Tx for bytes;

    /*********************
     * Variable Declarations *
     ********************/

    // External contracts
    DepositManager public depositManager;
    IncrementalTree public accountsTree;
    Logger public logger;
    ITokenRegistry public tokenRegistry;
    Registry public nameRegistry;
    Types.Batch[] public batches;
    MTUtils public merkleUtils;

    IRollupReddit public rollupReddit;

    bytes32
        public constant ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;
    address payable constant BURN_ADDRESS = 0x0000000000000000000000000000000000000000;
    uint256 STAKE_AMOUNT;
    Governance public governance;

    // this variable will be greater than 0 if
    // there is rollback in progress
    // will be reset to 0 once rollback is completed
    uint256 public invalidBatchMarker;

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.POB())
        );
        assert(msg.sender == pobContract.getCoordinator());
        _;
    }

    modifier isNotRollingBack() {
        assert(invalidBatchMarker == 0);
        _;
    }

    modifier isRollingBack() {
        assert(invalidBatchMarker > 0);
        _;
    }
}

contract RollupHelpers is RollupSetup {
    /**
     * @notice Returns the latest state root
     */
    function getLatestBalanceTreeRoot() public view returns (bytes32) {
        return batches[batches.length - 1].stateRoot;
    }

    /**
     * @notice Returns the total number of batches submitted
     */
    function numOfBatchesSubmitted() public view returns (uint256) {
        return batches.length;
    }

    function addNewBatch(
        bytes32 txRoot,
        bytes32 _updatedRoot,
        Types.Usage batchType
    ) internal {
        Types.Batch memory newBatch = Types.Batch({
            stateRoot: _updatedRoot,
            accountRoot: accountsTree.getTreeRoot(),
            depositTree: ZERO_BYTES32,
            committer: msg.sender,
            txRoot: txRoot,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            withdrawn: false,
            batchType: batchType
        });

        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            txRoot,
            _updatedRoot,
            batches.length - 1,
            batchType
        );
    }

    function addNewBatchWithDeposit(bytes32 _updatedRoot, bytes32 depositRoot)
        internal
    {
        Types.Batch memory newBatch = Types.Batch({
            stateRoot: _updatedRoot,
            accountRoot: accountsTree.getTreeRoot(),
            depositTree: depositRoot,
            committer: msg.sender,
            txRoot: ZERO_BYTES32,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            withdrawn: false,
            batchType: Types.Usage.Transfer
        });

        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            ZERO_BYTES32,
            _updatedRoot,
            batches.length - 1,
            Types.Usage.Deposit
        );
    }

    /**
     * @notice Returns the batch
     */
    function getBatch(uint256 _batch_id)
        public
        view
        returns (Types.Batch memory batch)
    {
        require(
            batches.length - 1 >= _batch_id,
            "Batch id greater than total number of batches, invalid batch id"
        );
        batch = batches[_batch_id];
    }

    /**
     * @notice SlashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challengers. Also deletes all the batches after invalid batch
     */
    function SlashAndRollback() public isRollingBack {
        uint256 challengerRewards = 0;
        uint256 burnedAmount = 0;
        uint256 totalSlashings = 0;

        for (uint256 i = batches.length - 1; i >= invalidBatchMarker; i--) {
            // if gas left is low we would like to do all the transfers
            // and persist intermediate states so someone else can send another tx
            // and rollback remaining batches
            if (gasleft() <= governance.MIN_GAS_LIMIT_LEFT()) {
                // exit loop gracefully
                break;
            }

            // load batch
            Types.Batch memory batch = batches[i];

            // calculate challeger's reward
            uint256 _challengerReward = (STAKE_AMOUNT.mul(2)).div(3);
            challengerRewards += _challengerReward;
            burnedAmount += STAKE_AMOUNT.sub(_challengerReward);

            // delete batch
            delete batches[i];

            // queue deposits again
            depositManager.enqueue(batch.depositTree);

            totalSlashings++;

            logger.logBatchRollback(
                i,
                batch.committer,
                batch.stateRoot,
                batch.txRoot
            );
            if (i == invalidBatchMarker) {
                // we have completed rollback
                // update the marker
                invalidBatchMarker = 0;
                break;
            }
        }

        // transfer reward to challenger
        (msg.sender).transfer(challengerRewards);

        // burn the remaning amount
        (BURN_ADDRESS).transfer(burnedAmount);

        // resize batches length
        batches.length = batches.length.sub(totalSlashings);

        logger.logRollbackFinalisation(totalSlashings);
    }
}

contract Rollup is RollupHelpers {
    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr, bytes32 genesisStateRoot) public {
        nameRegistry = Registry(_registryAddr);

        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.DEPOSIT_MANAGER())
        );

        governance = Governance(
            nameRegistry.getContractDetails(ParamManager.Governance())
        );
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        accountsTree = IncrementalTree(
            nameRegistry.getContractDetails(ParamManager.ACCOUNTS_TREE())
        );

        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );

        rollupReddit = IRollupReddit(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_REDDIT())
        );
        STAKE_AMOUNT = governance.STAKE_AMOUNT();

        addNewBatch(ZERO_BYTES32, genesisStateRoot, Types.Usage.Genesis);
    }

    /**
     * @notice Submits a new batch to batches
     * @param txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(
        bytes calldata txs,
        bytes32 _updatedRoot,
        Types.Usage batchType
    ) external payable onlyCoordinator isNotRollingBack {
        require(msg.value >= STAKE_AMOUNT, "Not enough stake committed");

        bytes32[] memory leaves;
        if (batchType == Types.Usage.CreateAccount) {
            leaves = txs.create_toLeafs();
        } else if (
            batchType == Types.Usage.Airdrop ||
            batchType == Types.Usage.Transfer
        ) {
            leaves = txs.transfer_toLeafs();
        } else if (batchType == Types.Usage.BurnConsent) {
            leaves = txs.burnConsent_toLeafs();
        } else if (batchType == Types.Usage.BurnExecution) {
            leaves = txs.burnExecution_toLeafs();
        }

        require(
            leaves.length <= governance.MAX_TXS_PER_BATCH(),
            "Batch contains more transations than the limit"
        );
        bytes32 txRoot = merkleUtils.getMerkleRootFromLeaves(leaves);
        require(
            txRoot != ZERO_BYTES32,
            "Cannot submit a transaction with no transactions"
        );
        addNewBatch(txRoot, _updatedRoot, batchType);
    }

    /**
     * @notice finalise deposits and submit batch
     */
    function finaliseDepositsAndSubmitBatch(
        uint256 _subTreeDepth,
        Types.AccountMerkleProof calldata _zero_account_mp
    ) external payable onlyCoordinator isNotRollingBack {
        bytes32 depositSubTreeRoot = depositManager.finaliseDeposits(
            _subTreeDepth,
            _zero_account_mp,
            getLatestBalanceTreeRoot()
        );
        // require(
        //     msg.value >= governance.STAKE_AMOUNT(),
        //     "Not enough stake committed"
        // );

        bytes32 updatedRoot = merkleUtils.updateLeafWithSiblings(
            depositSubTreeRoot,
            _zero_account_mp.accountIP.pathToAccount,
            _zero_account_mp.siblings
        );

        // add new batch
        addNewBatchWithDeposit(updatedRoot, depositSubTreeRoot);
    }

    /**
     *  disputeBatch processes a transactions and returns the updated balance tree
     *  and the updated leaves.
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function disputeBatch(
        uint256 _batch_id,
        bytes memory txs,
        bytes[] memory signatures,
        Types.BatchValidationProofs memory batchProofs
    ) public {
        {
            // check if batch is disputable
            require(
                !batches[_batch_id].withdrawn,
                "No point dispute a withdrawn batch"
            );
            require(
                block.number < batches[_batch_id].finalisesOn,
                "Batch already finalised"
            );

            require(
                (_batch_id < invalidBatchMarker || invalidBatchMarker == 0),
                "Already successfully disputed. Roll back in process"
            );

            require(
                batches[_batch_id].txRoot != ZERO_BYTES32,
                "Cannot dispute blocks with no transaction"
            );
        }

        bytes32 updatedBalanceRoot;
        bool isDisputeValid;
        bytes32 txRoot;
        (updatedBalanceRoot, txRoot, isDisputeValid) = rollupReddit
            .processBatch(
            batches[_batch_id - 1].stateRoot,
            batches[_batch_id].accountRoot,
            txs,
            signatures,
            batchProofs,
            batches[_batch_id].txRoot,
            batches[_batch_id].batchType
        );

        // dispute is valid, we need to slash and rollback :(
        if (isDisputeValid) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = _batch_id;
            SlashAndRollback();
            return;
        }

        // if new root doesnt match what was submitted by coordinator
        // slash and rollback
        if (updatedBalanceRoot != batches[_batch_id].stateRoot) {
            invalidBatchMarker = _batch_id;
            SlashAndRollback();
            return;
        }
    }

    /**
     * @notice Withdraw delay allows coordinators to withdraw their stake after the batch has been finalised
     * @param batch_id Batch ID that the coordinator submitted
     */
    function WithdrawStake(uint256 batch_id) public {
        Types.Batch memory committedBatch = batches[batch_id];
        require(
            !committedBatch.withdrawn,
            "Stake has been already withdrawn!!"
        );
        require(
            msg.sender == committedBatch.committer,
            "You are not the correct committer for this batch"
        );
        require(
            block.number > committedBatch.finalisesOn,
            "This batch is not yet finalised, check back soon!"
        );
        committedBatch.withdrawn = true;

        msg.sender.transfer(STAKE_AMOUNT);
        logger.logStakeWithdraw(msg.sender, batch_id);
    }
}
