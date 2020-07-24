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

import {BLSAccountRegistry} from "./BLSAccountRegistry.sol";
import {BLS} from "./libs/BLS.sol";
import {Tx} from "./libs/Tx.sol";

contract BurnConsent is FraudProofHelpers {
    using Tx for bytes;

    BLSAccountRegistry accountRegistry;

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

    // function generateTxRoot(Types.BurnConsent[] memory _txs)
    //     public
    //     view
    //     returns (bytes32 txRoot)
    // {
    //     // generate merkle tree from the txs provided by user
    //     bytes[] memory txs = new bytes[](_txs.length);
    //     for (uint256 i = 0; i < _txs.length; i++) {
    //         txs[i] = RollupUtils.CompressBurnConsent(_txs[i]);
    //     }
    //     txRoot = merkleUtils.getMerkleRoot(txs);
    //     return txRoot;
    // }

    // TODO: move somewhere nice
    uint256 constant ACCOUNT_ID_LEN = 4;
    uint256 constant MASK_ACCOUNT_ID = 0xffffffff;

    function signerAccountCheck(
        Types.SignerProof calldata proof,
        bytes32 state,
        bytes calldata signers,
        bytes calldata txs
    ) external view returns (uint256) {
        uint256 batchSize = txs.burnConsent_size();
        uint256 targetIndex = proof.targetIndex;
        require(targetIndex < batchSize, "Transfer: invalid target index");
        uint256 stateID = txs.burnConsent_stateIdOf(targetIndex);
        ValidateAccountMP(state, stateID, proof.account, proof.witness);
        uint256 committedSignerAccountID;
        bytes memory _signers = signers;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // TODO: use calldata copy
            let p_signers := add(
                _signers,
                mul(add(1, targetIndex), ACCOUNT_ID_LEN)
            )
            committedSignerAccountID := and(mload(p_signers), MASK_ACCOUNT_ID)
        }
        if (committedSignerAccountID != proof.account.ID) {
            return 1;
        }
        return 0;
    }

    function signatureCheck(
        uint256[2] calldata signature,
        Types.PubkeyAccountProofs calldata proof,
        bytes calldata txs,
        bytes calldata signers
    ) external view returns (uint256) {
        uint256 batchSize = txs.burnConsent_size();
        uint256[2][] memory messages = new uint256[2][](batchSize);
        // TODO use calldata copy
        bytes memory _signers = signers;
        uint256 off = ACCOUNT_ID_LEN;
        for (uint256 i = 0; i < batchSize; i++) {
            uint256 signerID;
            // solium-disable-next-line security/no-inline-assembly
            assembly {
                let p_signers := add(_signers, off)
                signerID := and(mload(p_signers), MASK_ACCOUNT_ID)
            }
            require(
                accountRegistry.exists(
                    signerID,
                    proof.pubkeys[i],
                    proof.witnesses[i]
                ),
                "Transfer: account does not exists"
            );
            messages[i] = txs.burnConsent_mapToPoint(i);
            off += ACCOUNT_ID_LEN;
        }
        if (!BLS.verifyMultiple(signature, proof.pubkeys, messages)) {
            return 1;
        }
        return 0;
    }

    function processBatch(
        bytes32 stateRoot,
        bytes memory txs,
        Types.BurnConsentTransitionProof[] memory proofs
    ) public view returns (bytes32, Types.ErrorCode) {
        uint256 batchSize = txs.burnConsent_size();
        require(batchSize > 0, "Transfer: empty batch");
        require(!txs.burnConsent_hasExcessData(), "Transfer: excess tx data");
        bytes32 acc = stateRoot;
        Tx.BurnConsent memory _tx;
        for (uint256 i = 0; i < batchSize; i++) {
            Types.ErrorCode err;
            _tx = Tx.burnConsent_decode(txs, i);
            (acc, , err, ) = processTx(acc, _tx, proofs[i]);
            if (Types.ErrorCode.NoError != err) {
                return (bytes32(0x00), err);
            }
        }
        return (acc, Types.ErrorCode.NoError);
    }

    function processTx(
        bytes32 stateRoot,
        Tx.BurnConsent memory _tx,
        Types.BurnConsentTransitionProof memory proof
    )
        public
        view
        returns (
            bytes32 acc,
            bytes memory updated,
            Types.ErrorCode,
            bool
        )
    {
        Types.UserAccount memory account = proof.account;
        // A. check sender inclusion in state
        ValidateAccountMP(stateRoot, _tx.stateID, account, proof.witness);
        //
        //
        // FIX: cannot be an empty account
        //
        // if (proof.account.isEmptyAccount()) {
        //   return bytes32(0x00), 1;
        // }
        //
        //
        if (account.nonce != _tx.nonce) {
            return (bytes32(0x00), "", Types.ErrorCode.BadNonce, false);
        }
        account.nonce += 1;
        account.burn = _tx.amount;
        updated = RollupUtils.BytesFromAccount(account);
        acc = merkleUtils.updateLeafWithSiblings(
            keccak256(updated),
            _tx.stateID,
            proof.witness
        );
        return (acc, updated, Types.ErrorCode.NoError, true);
    }

    function ApplyBurnConsentTx(
        Types.AccountMerkleProof memory _merkle_proof,
        Types.BurnConsent memory _tx
    ) public view returns (bytes memory updatedAccount, bytes32 newRoot) {
        Types.UserAccount memory account = _merkle_proof.accountIP.account;
        if (_tx.cancel) {
            account.burn -= _tx.amount;
        } else {
            account.burn += _tx.amount;
        }

        newRoot = UpdateAccountWithSiblings(account, _merkle_proof);
        updatedAccount = RollupUtils.BytesFromAccount(account);
        return (updatedAccount, newRoot);
    }
}
