pragma solidity ^0.5.15;

import { Types } from "./libs/Types.sol";

contract Logger {
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

    event StakeWithdraw(address committed, uint256 batchID);

    function logStakeWithdraw(address committed, uint256 batchID) public {
        emit StakeWithdraw(committed, batchID);
    }

    event BatchRollback(uint256 batchID);

    function logBatchRollback(uint256 batchID) public {
        emit BatchRollback(batchID);
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

    event PubkeyRegistered(uint256[4] pubkey, uint256 pubkeyID);

    function logPubkeyRegistered(uint256[4] calldata pubkey, uint256 pubkeyID)
        external
    {
        emit PubkeyRegistered(pubkey, pubkeyID);
    }

    event DepositQueued(uint256 pubkeyID, bytes data);

    function logDepositQueued(uint256 accountID, bytes memory data) public {
        emit DepositQueued(accountID, data);
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
