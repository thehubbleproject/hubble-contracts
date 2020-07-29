pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { FraudProofHelpers } from "./FraudProof.sol";
import { Types } from "./libs/Types.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { Governance } from "./Governance.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";

contract BurnExecution is FraudProofHelpers {
    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        governance = Governance(
            nameRegistry.getContractDetails(ParamManager.Governance())
        );

        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );

        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
    }

    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processBurnExecutionBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        bytes memory txs,
        Types.BatchValidationProofs memory batchProofs,
        bytes32 expectedTxRoot
    )
        public
        view
        returns (
            bytes32,
            bytes32,
            bool
        )
    {
        uint256 length = txs.burnExecution_size();

        bytes32 actualTxRoot = merkleUtils.getMerkleRootFromLeaves(
            txs.burnExecution_toLeafs()
        );
        if (expectedTxRoot != ZERO_BYTES32) {
            require(
                actualTxRoot == expectedTxRoot,
                "Invalid dispute, tx root doesn't match"
            );
        }

        bool isTxValid;

        for (uint256 i = 0; i < length; i++) {
            // call process tx update for every transaction to check if any
            // tx evaluates correctly
            (stateRoot, , , isTxValid) = processBurnExecutionTx(
                stateRoot,
                txs,
                i,
                batchProofs.accountProofs[i].from
            );

            if (!isTxValid) {
                break;
            }
        }

        return (stateRoot, actualTxRoot, !isTxValid);
    }

    function ApplyBurnExecutionTx(
        Types.AccountMerkleProof memory _fromAccountProof
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _fromAccountProof.accountIP.account;

        account.balance -= account.burn;
        account.lastBurn = RollupUtils.GetYearMonth();

        updatedAccount = RollupUtils.BytesFromAccount(account);
        newRoot = UpdateAccountWithSiblings(account, _fromAccountProof);
        return (updatedAccount, newRoot);
    }

    /**
     * @notice Overrides processTx in FraudProof
     */
    function processBurnExecutionTx(
        bytes32 _balanceRoot,
        bytes memory txs,
        uint256 i,
        Types.AccountMerkleProof memory _fromAccountProof
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        ValidateAccountMP(_balanceRoot, _fromAccountProof);
        Types.UserAccount memory account = _fromAccountProof.accountIP.account;
        // FIX:
        // if (txs.burnExecution_fromIndexOf(i) != account.ID) {
        //     return (ZERO_BYTES32, "", Types.ErrorCode.BadFromIndex, false);
        // }
        if (account.balance < account.burn) {
            return (
                ZERO_BYTES32,
                "",
                Types.ErrorCode.NotEnoughTokenBalance,
                false
            );
        }

        uint256 yearMonth = RollupUtils.GetYearMonth();
        if (account.lastBurn == yearMonth) {
            return (
                ZERO_BYTES32,
                "",
                Types.ErrorCode.BurnAlreadyExecuted,
                false
            );
        }

        bytes32 newRoot;
        bytes memory new_from_account;
        (new_from_account, newRoot) = ApplyBurnExecutionTx(_fromAccountProof);

        return (newRoot, new_from_account, Types.ErrorCode.NoError, true);
    }
}
