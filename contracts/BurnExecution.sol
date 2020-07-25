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

import {Tx} from "./libs/Tx.sol";

contract BurnExecution is FraudProofHelpers {
    using Tx for bytes;

    // /*********************
    //  * Constructor *
    //  ********************/
    // constructor(address _registryAddr) public {
    //     nameRegistry = Registry(_registryAddr);

    //     governance = Governance(
    //         nameRegistry.getContractDetails(ParamManager.Governance())
    //     );

    //     merkleUtils = MTUtils(
    //         nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
    //     );

    //     tokenRegistry = ITokenRegistry(
    //         nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
    //     );
    // }

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

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.BurnExecutionProof[] memory proofs
    ) public view returns (bytes32, Types.ErrorCode) {
        uint256 batchSize = txs.burnExecution_size();
        require(batchSize > 0, "Transfer: empty batch");
        require(!txs.burnExecution_hasExcessData(), "Transfer: excess tx data");
        bytes32 acc = stateRoot;
        for (uint256 i = 0; i < batchSize; i++) {
            Types.ErrorCode err;
            (acc, , err, ) = processTx(
                acc,
                txs.burnExecution_stateIdOf(i),
                proofs[i]
            );
            if (Types.ErrorCode.NoError != err) {
                return (bytes32(0x00), err);
            }
        }
        return (acc, Types.ErrorCode.NoError);
    }

    function processTx(
        bytes32 stateRoot,
        uint256 stateID,
        Types.BurnExecutionProof memory proof
    )
        public
        view
        returns (
            bytes32,
            bytes memory updated,
            Types.ErrorCode,
            bool
        )
    {
        // A. check burner inclusion in state
        ValidateAccountMP(stateRoot, stateID, proof.account, proof.witness);
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.senderAccounts.isEmptyAccount()) {
        //   return bytes32(0x00), 1;
        // }
        //
        //
        // B. apply diff for burner
        Types.UserAccount memory account = proof.account;
        if (account.balance < account.burn) {
            return (
                bytes32(0x00),
                "",
                Types.ErrorCode.NotEnoughTokenBalance,
                false
            );
        }
        account.balance -= account.burn;
        uint256 yearMonth = RollupUtils.GetYearMonth();
        if (account.lastBurn == yearMonth) {
            return (
                ZERO_BYTES32,
                "",
                Types.ErrorCode.BurnAlreadyExecuted,
                false
            );
        }
        account.lastBurn = yearMonth;
        updated = RollupUtils.BytesFromAccount(account);
        bytes32 acc = merkleUtils.updateLeafWithSiblings(
            keccak256(updated),
            stateID,
            proof.witness
        );
        return (acc, updated, Types.ErrorCode.NoError, true);
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
}
