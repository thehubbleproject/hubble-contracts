pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import {DepositManager} from "./DepositManager.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Rollup} from "./Rollup.sol";
import {Types} from "./libs/Types.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {POB} from "./POB.sol";

/*
CoordiantorProxy contract is the one contract that the provides all the functions that coordinator needs to work with
*/
contract CoordiantorProxy {
    DepositManager public depositManager;
    Rollup public rollup;
    Registry public nameRegistry;
    
    modifier isNotRollingBack() {
        assert(rollup.getInvalidBatchMarker() == 0);
        _;
    }

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.POB())
        );
        assert(msg.sender == pobContract.getCoordinator());
        _;
    }

    modifier isNotWaitingForFinalisation() {
        assert(depositManager.isDepositPaused() == false);
        _;
    }
    
    /*********************
     * Constructor *
    ********************/

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.DEPOSIT_MANAGER())
        );
        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );
    }

    function finaliseDepositsAndSubmitBatch(
        uint256 _subTreeDepth,
        Types.AccountMerkleProof calldata _zero_account_mp
    ) external payable onlyCoordinator isNotRollingBack {
        rollup.finaliseDepositsAndSubmitBatch(_subTreeDepth,_zero_account_mp);
    }

     /**
     * @notice Submits a new batch to batches
     * @param _txs Compressed transactions .
     * @param _updatedRoot New balance tree root after processing all the transactions
     */
    function submitBatch(bytes[] calldata _txs, bytes32 _updatedRoot)
        external
        payable
        onlyCoordinator
        isNotRollingBack
        isNotWaitingForFinalisation
    {
        rollup.submitBatch(_txs,_updatedRoot);
    }





}
