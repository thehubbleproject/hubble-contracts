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
    mapping(uint256 => Types.BatchCommit) public batches;
    MTUtils public merkleUtils;
    uint256 public batchPointer = 0;

    IRollupReddit public rollupReddit;

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

contract StakeManager {
    uint256 public stakeAmount;

    mapping(uint256 => uint256) public stakes;

    function stake(uint256 stakeIndex) internal {
        require(
            msg.value == stakeAmount,
            "StakeManager: not enough stake committed"
        );
        stakes[stakeIndex] = stakeAmount;
    }

    function reward(address payable challenger, uint256 amount) internal {
        challenger.transfer(amount);
    }

    function burn(uint256 amount) internal {
        address(0).transfer(amount);
    }

    function changeStakeAmount(uint256 _stakeAmount) internal {
        stakeAmount = _stakeAmount;
    }
}

contract RollupHelpers is RollupSetup, StakeManager {
    /**
     * @notice Returns the latest state root
     */
    function getLatestBalanceTreeRoot() public view returns (bytes32) {
        return batches[batchPointer].stateRoot;
    }

    function hashBatch(Types.Batch memory batch) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    batch.stateRoot,
                    batch.accountRoot,
                    batch.depositTree,
                    batch.committer,
                    batch.txRoot,
                    batch.finalisesOn,
                    batch.batchType
                )
            );
    }

    function addNewBatch(
        bytes32 txRoot,
        bytes32 _updatedRoot,
        Types.Usage batchType
    ) internal {
        Types.Batch memory newBatch;
        newBatch.stateRoot = _updatedRoot;
        newBatch.accountRoot = accountsTree.getTreeRoot();
        // newBatch.depositTree default initialized to 0 bytes
        newBatch.committer = msg.sender;
        newBatch.txRoot = txRoot;
        newBatch.finalisesOn = block.number + governance.TIME_TO_FINALISE();
        // newBatch.withdrawn default initialized to false
        newBatch.batchIndex = batchPointer;
        newBatch.batchType = batchType;

        bytes32 batchHash = hashBatch(newBatch);

        batches[batchPointer] = Types.BatchCommit({
            batchHash: batchHash,
            stateRoot: _updatedRoot
        });
        logger.logNewBatch(
            newBatch.committer,
            txRoot,
            _updatedRoot,
            batchPointer,
            batchType
        );
        batchPointer += 1;
    }

    function addNewBatchWithDeposit(bytes32 _updatedRoot, bytes32 depositRoot)
        internal
    {
        Types.Batch memory newBatch;
        newBatch.stateRoot = _updatedRoot;
        newBatch.accountRoot = accountsTree.getTreeRoot();
        // newBatch.depositTree default initialized to 0 bytes
        newBatch.depositTree = depositRoot;
        newBatch.committer = msg.sender;
        newBatch.finalisesOn = block.number + governance.TIME_TO_FINALISE();
        // newBatch.withdrawn default initialized to false
        newBatch.batchIndex = batchPointer;
        newBatch.batchType = Types.Usage.Deposit;

        bytes32 batchHash = hashBatch(newBatch);

        batches[batchPointer] = Types.BatchCommit({
            batchHash: batchHash,
            stateRoot: _updatedRoot
        });

        logger.logNewBatch(
            newBatch.committer,
            bytes32(0x00),
            _updatedRoot,
            batchPointer,
            Types.Usage.Deposit
        );
        batchPointer += 1;
    }

    /**
     * @notice SlashAndRollback slashes all the coordinator's who have built on top of the invalid batch
     * and rewards challengers. Also deletes all the batches after invalid batch
     */
    function SlashAndRollback() public isRollingBack {
        uint256 challengerRewards = 0;
        uint256 burnedAmount = 0;
        uint256 totalSlashings = 0;

        for (uint256 i = batchPointer; i >= invalidBatchMarker; i--) {
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
        batchPointer = batchPointer.sub(totalSlashings);

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
        changeStakeAmount(governance.STAKE_AMOUNT());

        addNewBatch(bytes32(0x00), genesisStateRoot, Types.Usage.Genesis);
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
        stake(batchPointer);
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
            txRoot != bytes32(0x00),
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
        Types.Batch memory batch,
        bytes memory txs,
        Types.BatchValidationProofs memory batchProofs
    ) public {
        // check if batch is disputable
        require(!batch.withdrawn, "No point dispute a withdrawn batch");
        require(block.number < batch.finalisesOn, "Batch already finalised");

        require(
            (batch.batchIndex < invalidBatchMarker || invalidBatchMarker == 0),
            "Already successfully disputed. Roll back in process"
        );

        require(
            batch.txRoot != bytes32(0x00),
            "Cannot dispute blocks with no transaction"
        );

        bytes32 updatedBalanceRoot;
        bool isDisputeValid;
        bytes32 txRoot;
        (updatedBalanceRoot, txRoot, isDisputeValid) = rollupReddit
            .processBatch(
            batches[batch.batchIndex - 1].stateRoot,
            batch.accountRoot,
            txs,
            batchProofs,
            batch.txRoot,
            batch.batchType
        );

        // dispute is valid, we need to slash and rollback :(
        if (isDisputeValid) {
            // before rolling back mark the batch invalid
            // so we can pause and unpause
            invalidBatchMarker = batch.batchIndex;
            SlashAndRollback();
            return;
        }

        // if new root doesnt match what was submitted by coordinator
        // slash and rollback
        if (updatedBalanceRoot != batch.stateRoot) {
            invalidBatchMarker = batch.batchIndex;
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
