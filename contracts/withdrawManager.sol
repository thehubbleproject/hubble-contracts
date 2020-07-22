pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { ECVerify } from "./libs/ECVerify.sol";
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ParamManager } from "./libs/ParamManager.sol";

import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { IERC20 } from "./interfaces/IERC20.sol";

import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { POB } from "./POB.sol";
import { Governance } from "./Governance.sol";
import { Rollup } from "./rollup.sol";

contract WithdrawManager {
    using ECVerify for bytes32;

    MTUtils public merkleUtils;
    ITokenRegistry public tokenRegistry;
    Governance public governance;
    Registry public nameRegistry;
    Rollup public rollup;

    // Stores transaction paths claimed per batch
    bool[][] withdrawTxClaimed;

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

        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );

        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        withdrawTxClaimed = new bool[][](governance.MAX_TXS_PER_BATCH());
    }

    /**
     * @notice Allows user to withdraw the balance in the leaf of the balances tree.
     *        User has to do the following: Prove that a transfer of X tokens was made to the burn address or leaf 0
     *        The batch we are allowing withdraws from should have been already finalised, so we can assume all data in the batch to be correct
     * @param _batch_id Deposit tree depth or depth of subtree that is being deposited
     * @param withdraw_tx_proof contains the siblints, txPath and the txData for the withdraw transaction
     */
    function Withdraw(
        uint256 _batch_id,
        Types.PDAMerkleProof memory _pda_proof,
        Types.TransactionMerkleProof memory withdraw_tx_proof
    ) public {
        Types.Batch memory batch = rollup.getBatch(_batch_id);

        // check if the batch is finalised
        require(block.number > batch.finalisesOn, "Batch not finalised yt");
        // verify transaction exists in the batch
        merkleUtils.verify(
            batch.txRoot,
            RollupUtils.BytesFromTx(withdraw_tx_proof._tx.data),
            withdraw_tx_proof._tx.pathToTx,
            withdraw_tx_proof.siblings
        );

        // check if the transaction is withdraw transaction
        // ensure the `to` leaf was the 0th leaf
        require(
            withdraw_tx_proof._tx.data.toIndex == 0,
            "Not a withdraw transaction"
        );

        bool isClaimed = withdrawTxClaimed[_batch_id][withdraw_tx_proof
            ._tx
            .pathToTx];
        require(!isClaimed, "Withdraw transaction already claimed");
        withdrawTxClaimed[_batch_id][withdraw_tx_proof._tx.pathToTx] = true;

        // withdraw checks out, transfer to the account in account tree
        address tokenContractAddress = tokenRegistry.registeredTokens(
            withdraw_tx_proof._tx.data.tokenType
        );

        // convert pubkey path to ID
        uint256 computedID = merkleUtils.pathToIndex(
            _pda_proof._pda.pathToPubkey,
            governance.MAX_DEPTH()
        );

        require(
            computedID == withdraw_tx_proof._tx.data.fromIndex,
            "Pubkey not related to the from account in the transaction"
        );

        address receiver = RollupUtils.calculateAddress(
            _pda_proof._pda.pubkey_leaf.pubkey
        );

        require(
            receiver ==
                RollupUtils.HashFromTx(withdraw_tx_proof._tx.data).ecrecovery(
                    withdraw_tx_proof._tx.data.signature
                ),
            "Signature is incorrect"
        );

        uint256 amount = withdraw_tx_proof._tx.data.amount;

        IERC20 tokenContract = IERC20(tokenContractAddress);
        require(tokenContract.transfer(receiver, amount), "Unable to trasnfer");
    }
}
