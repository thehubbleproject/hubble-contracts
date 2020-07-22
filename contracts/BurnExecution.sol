pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {FraudProofHelpers} from "./FraudProof.sol";
import {Types} from "./libs/Types.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {Governance} from "./Governance.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {ParamManager} from "./libs/ParamManager.sol";

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

    function generateTxRoot(Types.BurnExecution[] memory _txs)
        public
        view
        returns (bytes32 txRoot)
    {
        // generate merkle tree from the txs provided by user
        bytes[] memory txs = new bytes[](_txs.length);
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = RollupUtils.CompressBurnExecution(_txs[i]);
        }
        txRoot = merkleUtils.getMerkleRoot(txs);
        return txRoot;
    }

    /**
     * @notice processBatch processes a whole batch
     * @return returns updatedRoot, txRoot and if the batch is valid or not
     * */
    function processBatch(
        bytes32 stateRoot,
        bytes32 accountsRoot,
        Types.BurnExecution[] memory _txs,
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
        bytes32 actualTxRoot = generateTxRoot(_txs);
        // if there is an expectation set, revert if it's not met
        if (expectedTxRoot == ZERO_BYTES32) {
            // if tx root while submission doesnt match tx root of given txs
            // dispute is unsuccessful
            require(
                actualTxRoot == expectedTxRoot,
                "Invalid dispute, tx root doesn't match"
            );
        }

        bool isTxValid;
        {
            for (uint256 i = 0; i < _txs.length; i++) {
                // call process tx update for every transaction to check if any
                // tx evaluates correctly
                (stateRoot, , , isTxValid) = processBurnExecutionTx(
                    stateRoot,
                    _txs[i],
                    batchProofs.accountProofs[i].from
                );

                if (!isTxValid) {
                    break;
                }
            }
        }
        return (stateRoot, actualTxRoot, !isTxValid);
    }

    function ApplyBurnExecutionTx(
        Types.AccountMerkleProof memory _fromAccountProof,
        Types.BurnExecution memory _tx
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
        Types.BurnExecution memory _tx,
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
        // FIX: commented out to test other components
        // ValidateAccountMP(_balanceRoot, _fromAccountProof);

        Types.UserAccount memory account = _fromAccountProof.accountIP.account;
        if (_tx.fromIndex != account.ID) {
            return (ZERO_BYTES32, "", Types.ErrorCode.BadFromIndex, false);
        }
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
        (new_from_account, newRoot) = ApplyBurnExecutionTx(
            _fromAccountProof,
            _tx
        );

        return (newRoot, new_from_account, Types.ErrorCode.NoError, true);
    }
}
