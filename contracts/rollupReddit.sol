pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import {IReddit} from "./interfaces/IReddit.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {Types} from "./libs/Types.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";

contract RollupReddit {
    Registry public nameRegistry;
    IReddit public airdrop;
    IReddit public burnConsent;
    IReddit public burnExecution;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        airdrop = IReddit(
            nameRegistry.getContractDetails(ParamManager.AIRDROP())
        );
        burnConsent = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_CONSENT())
        );
        burnExecution = IReddit(
            nameRegistry.getContractDetails(ParamManager.BURN_EXECUTION())
        );
    }

    function processTxAirdrop(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.DropTx memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        return
            airdrop.processTxAirdrop(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
    }

    function processTxBurnConsent(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnConsent memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        return
            burnConsent.processTxBurnConsent(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
    }

    function processTxBurnExecution(
        bytes32 _balanceRoot,
        bytes32 _accountsRoot,
        Types.BurnExecution memory _tx,
        Types.PDAMerkleProof memory _from_pda_proof,
        Types.AccountProofs memory accountProofs
    )
        public
        view
        returns (
            bytes32,
            bytes memory,
            bytes memory,
            Types.ErrorCode,
            bool
        )
    {
        return
            burnExecution.processTxBurnExecution(
                _balanceRoot,
                _accountsRoot,
                _tx,
                _from_pda_proof,
                accountProofs
            );
    }
}
