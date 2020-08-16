pragma solidity ^0.5.15;

import { Types } from "./libs/Types.sol";

contract Logger {
    event PubkeyRegistered(uint256[4] pubkey, uint256 accountID);

    function logPubkeyRegistered(uint256[4] calldata pubkey, uint256 accountID)
        external
    {
        emit PubkeyRegistered(pubkey, accountID);
    }

    /*********************
     * Rollup Contract *
     ********************/
    event NewBatch(
        address committer,
        bytes32 updatedRoot,
        uint256 index,
        Types.Usage batchType
    );

    function logNewBatch(
        address committer,
        bytes32 updatedRoot,
        uint256 index,
        Types.Usage batchType
    ) public {
        emit NewBatch(committer, updatedRoot, index, batchType);
    }

    event StakeWithdraw(address committed, uint256 batch_id);

    function logStakeWithdraw(address committed, uint256 batch_id) public {
        emit StakeWithdraw(committed, batch_id);
    }

    event BatchRollback(uint256 batch_id);

    function logBatchRollback(uint256 batch_id) public {
        emit BatchRollback(batch_id);
    }

    event RollbackFinalisation(uint256 totalBatchesSlashed);

    function logRollbackFinalisation(uint256 totalBatchesSlashed) public {
        emit RollbackFinalisation(totalBatchesSlashed);
    }

    event RegisteredToken(uint256 tokenType, address tokenContract);

    function logRegisteredToken(uint256 tokenType, address tokenContract)
        public
    {
        emit RegisteredToken(tokenType, tokenContract);
    }

    event RegistrationRequest(address tokenContract);

    function logRegistrationRequest(address tokenContract) public {
        emit RegistrationRequest(tokenContract);
    }

    event NewPubkeyAdded(uint256 AccountID, bytes pubkey);

    function logNewPubkeyAdded(uint256 accountID, bytes memory pubkey) public {
        emit NewPubkeyAdded(accountID, pubkey);
    }

    event DepositQueued(uint256 AccountID, bytes data);

    function logDepositQueued(uint256 accountID, bytes memory data) public {
        emit DepositQueued(accountID, data);
    }

    event DepositLeafMerged(bytes32 left, bytes32 right, bytes32 newRoot);

    function logDepositLeafMerged(
        bytes32 left,
        bytes32 right,
        bytes32 newRoot
    ) public {
        emit DepositLeafMerged(left, right, newRoot);
    }

    event DepositSubTreeReady(bytes32 root);

    function logDepositSubTreeReady(bytes32 root) public {
        emit DepositSubTreeReady(root);
    }

    event DepositsFinalised(bytes32 depositSubTreeRoot, uint256 pathToSubTree);

    function logDepositFinalised(
        bytes32 depositSubTreeRoot,
        uint256 pathToSubTree
    ) public {
        emit DepositsFinalised(depositSubTreeRoot, pathToSubTree);
    }
}
