pragma solidity ^0.5.15;

import { Types } from "./libs/Types.sol";

contract Logger {
    /*********************
     * Rollup Contract *
     ********************/
    event NewBatch(
        address committer,
        bytes32 txroot,
        bytes32 updatedRoot,
        uint256 index,
        Types.Usage batchType
    );

    function logNewBatch(
        address committer,
        bytes32 txroot,
        bytes32 updatedRoot,
        uint256 index,
        Types.Usage batchType
    ) public {
        emit NewBatch(committer, txroot, updatedRoot, index, batchType);
    }

    event StakeWithdraw(address committed, uint256 amount, uint256 batch_id);

    function logStakeWithdraw(
        address committed,
        uint256 amount,
        uint256 batch_id
    ) public {
        emit StakeWithdraw(committed, amount, batch_id);
    }

    event BatchRollback(
        uint256 batch_id,
        address committer,
        bytes32 stateRoot,
        bytes32 txRoot,
        uint256 stakeSlashed
    );

    function logBatchRollback(
        uint256 batch_id,
        address committer,
        bytes32 stateRoot,
        bytes32 txRoot,
        uint256 stakeSlashed
    ) public {
        emit BatchRollback(
            batch_id,
            committer,
            stateRoot,
            txRoot,
            stakeSlashed
        );
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

    event DepositQueued(uint256 AccountID, bytes pubkey, bytes data);

    function logDepositQueued(
        uint256 accountID,
        bytes memory pubkey,
        bytes memory data
    ) public {
        emit DepositQueued(accountID, pubkey, data);
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
