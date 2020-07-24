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

contract CreateAccount is FraudProofHelpers {
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

    function generateTxRoot(Types.CreateAccount[] memory _txs)
        public
        view
        returns (bytes32 txRoot)
    {
        // generate merkle tree from the txs provided by user
        bytes[] memory txs = new bytes[](_txs.length);
        for (uint256 i = 0; i < _txs.length; i++) {
            txs[i] = RollupUtils.CompressCreateAccount(_txs[i]);
        }
        txRoot = merkleUtils.getMerkleRoot(txs);
        return txRoot;
    }

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.CreateAccountTransitionProof[] memory proofs
    ) public view returns (bytes32, Types.ErrorCode) {
        uint256 batchSize = txs.create_size();
        require(batchSize > 0, "CreateAccount: empty batch");
        require(!txs.create_hasExcessData(), "CreateAccount: excess tx data");
        bytes32 acc = stateRoot;
        Tx.CreateAccount memory _tx;
        for (uint256 i = 0; i < batchSize; i++) {
            Types.ErrorCode err;
            _tx = Tx.create_decode(txs, i);
            (acc, , err, ) = processTx(acc, _tx, proofs[i]);
            if (Types.ErrorCode.NoError != err) {
                return (bytes32(0x00), err);
            }
        }
        return (acc, Types.ErrorCode.NoError);
    }

    function processTx(
        bytes32 stateRoot,
        Tx.CreateAccount memory _tx,
        Types.CreateAccountTransitionProof memory proof
    )
        public
        view
        returns (
            bytes32,
            bytes memory created,
            Types.ErrorCode,
            bool
        )
    {
        uint256 stateID = _tx.stateID;
        // if (!merkleUtils.verifyEmpty(stateRoot, stateID, proof.witness)) {
        //     return (
        //         bytes32(0x00),
        //         "",
        //         Types.ErrorCode.NotCreatingOnZeroAccount,
        //         false
        //     );
        // }

        Types.UserAccount memory account = Types.UserAccount(
            _tx.accountID,
            _tx.tokenType,
            0,
            0,
            0,
            0
        );
        created = RollupUtils.BytesFromAccount(account);
        bytes32 updatedRoot = merkleUtils.updateLeafWithSiblings(
            keccak256(created),
            _tx.stateID,
            proof.witness
        );
        return (updatedRoot, created, Types.ErrorCode.NoError, true);
    }

    function ApplyCreateAccountTx(
        Types.AccountMerkleProof memory _merkle_proof,
        Types.CreateAccount memory _tx
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account;
        account.ID = _tx.toIndex;
        account.tokenType = _tx.tokenType;
        account.balance = 0;
        account.nonce = 0;
        account.burn = 0;
        account.lastBurn = 0;

        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);
        updatedAccount = RollupUtils.BytesFromAccount(account);
        return (updatedAccount, newRoot);
    }
}
