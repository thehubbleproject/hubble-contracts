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
import { BLSAccountRegistry } from "./BLSAccountRegistry.sol";
import { Logger } from "./logger.sol";
import { POB } from "./POB.sol";
import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Governance } from "./Governance.sol";
import { DepositManager } from "./DepositManager.sol";

interface IRollupReddit {
    function processBatch(
        bytes32 initialStateRoot,
        bytes calldata _txs,
        Types.BatchValidationProofs calldata batchProofs,
        bytes32 expectedTxHashCommitment,
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
    BLSAccountRegistry public accountRegistry;
    Logger public logger;
    ITokenRegistry public tokenRegistry;
    Registry public nameRegistry;
    Types.Batch[] public batches;
    MTUtils public merkleUtils;

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

contract RollupHelpers is RollupSetup {
    /**
     * @notice Returns the latest state root
     */
    function getLatestBalanceTreeRoot() public view returns (bytes32) {
        return batches[batches.length - 1].commitmentRoot;
    }

    /**
     * @notice Returns the total number of batches submitted
     */
    function numOfBatchesSubmitted() public view returns (uint256) {
        return batches.length;
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
     * Its a public function because we will need to pause if we are not able to delete all batches in one tx
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
            depositManager.enqueue(batch.depositRoot);

            totalSlashings++;

            logger.logBatchRollback(i);

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
    bytes32
        public constant ZERO_BYTES32 = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    uint256[2] public ZERO_AGG_SIG = [0, 0];

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
        accountRegistry = BLSAccountRegistry(
            nameRegistry.getContractDetails(ParamManager.ACCOUNT_REGISTRY())
        );

        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );

        rollupReddit = IRollupReddit(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_REDDIT())
        );
        STAKE_AMOUNT = governance.STAKE_AMOUNT();
        bytes32 genesisCommitment = RollupUtils.CommitmentToHash(
            genesisStateRoot,
            accountRegistry.root(),
            ZERO_BYTES32,
            ZERO_AGG_SIG,
            uint8(Types.Usage.Genesis)
        );
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: genesisCommitment,
            committer: msg.sender,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            depositRoot: ZERO_BYTES32,
            withdrawn: false
        });
        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            genesisStateRoot,
            batches.length - 1,
            Types.Usage.Genesis
        );
    }

    function submitBatch(
        bytes[] calldata txs,
        bytes32[] calldata updatedRoots,
        Types.Usage batchType,
        uint256[2][] calldata aggregatedSignatures
    ) external payable onlyCoordinator {
        // require(msg.value >= STAKE_AMOUNT, "Not enough stake committed");
        uint256 commmitmentLength = updatedRoots.length;
        bytes32[] memory commitments = new bytes32[](commmitmentLength);
        bytes32 pubkeyTreeRoot = accountRegistry.root();
        for (uint256 i = 0; i < commmitmentLength; i++) {
            commitments[i] = (
                RollupUtils.CommitmentToHash(
                    updatedRoots[i],
                    pubkeyTreeRoot,
                    keccak256(abi.encode(txs[i])),
                    aggregatedSignatures[i],
                    uint8(batchType)
                )
            );
        }
        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: merkleUtils.getMerkleRootFromLeaves(commitments),
            committer: msg.sender,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            depositRoot: ZERO_BYTES32,
            withdrawn: false
        });
        batches.push(newBatch);
        logger.logNewBatch(
            newBatch.committer,
            updatedRoots[updatedRoots.length - 1],
            batches.length - 1,
            batchType
        );
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

        require(
            msg.value >= governance.STAKE_AMOUNT(),
            "Not enough stake committed"
        );

        bytes32 newRoot = merkleUtils.updateLeafWithSiblings(
            depositSubTreeRoot,
            _zero_account_mp.accountIP.pathToAccount,
            _zero_account_mp.siblings
        );
        bytes32 depositCommitment = RollupUtils.CommitmentToHash(
            newRoot,
            accountRegistry.root(),
            ZERO_BYTES32,
            ZERO_AGG_SIG,
            uint8(Types.Usage.Deposit)
        );

        Types.Batch memory newBatch = Types.Batch({
            commitmentRoot: depositCommitment,
            committer: msg.sender,
            finalisesOn: block.number + governance.TIME_TO_FINALISE(),
            depositRoot: depositSubTreeRoot,
            withdrawn: false
        });

        batches.push(newBatch);

        logger.logNewBatch(
            newBatch.committer,
            newRoot,
            batches.length - 1,
            Types.Usage.Deposit
        );
    }

    /**
     *  disputeBatch processes a transactions and returns the updated balance tree
     *  and the updated leaves.
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function disputeBatch(
        uint256 _batch_id,
        Types.CommitmentInclusionProof memory commitmentMP,
        bytes memory txs,
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
        }

        // verify is the commitment exits in the batch
        {
            require(
                merkleUtils.verifyLeaf(
                    batches[_batch_id].commitmentRoot,
                    RollupUtils.CommitmentToHash(
                        commitmentMP.commitment.stateRoot,
                        commitmentMP.commitment.accountRoot,
                        commitmentMP.commitment.txHashCommitment,
                        commitmentMP.commitment.aggregatedSignature,
                        uint8(commitmentMP.commitment.batchType)
                    ),
                    commitmentMP.pathToCommitment,
                    commitmentMP.siblings
                ),
                "Commitment not present in batch"
            );

            require(
                commitmentMP.commitment.txHashCommitment != ZERO_BYTES32,
                "Cannot dispute blocks with no transaction"
            );
        }

        bytes32 updatedBalanceRoot;
        bool isDisputeValid;
        bytes32 txRoot;
        (updatedBalanceRoot, txRoot, isDisputeValid) = rollupReddit
            .processBatch(
            commitmentMP.commitment.stateRoot,
            txs,
            batchProofs,
            commitmentMP.commitment.txHashCommitment,
            commitmentMP.commitment.batchType
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
        if (updatedBalanceRoot != commitmentMP.commitment.stateRoot) {
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
