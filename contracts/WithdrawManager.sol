pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Types } from "./libs/Types.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { Tx } from "./libs/Tx.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { Vault } from "./Vault.sol";

contract WithdrawManager {
    using Tx for bytes;
    Registry public nameRegistry;
    Vault public vault;
    mapping(uint256 => mapping(uint256 => uint256)) balances;
    ITokenRegistry public tokenRegistry;

    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        vault = Vault(nameRegistry.getContractDetails(ParamManager.VAULT()));
    }

    function ProcessWithdrawCommitment(
        uint256 _batch_id,
        Types.MMCommitmentInclusionProof calldata commitmentMP,
        bytes calldata txs
    ) external {
        vault.requestApproval(_batch_id, commitmentMP, txs);
        // txs are present in commitment
        Tx.MassMigration memory _tx;
        // read all transactions and make the transfers
        for (uint256 i = 0; i < txs.massMigration_size(); i++) {
            _tx = txs.massMigration_decode(i);
            balances[_tx.fromIndex][commitmentMP
                .commitment
                .massMigrationMetaInfo
                .tokenID] = _tx.amount;
        }
        // check token type exists
        address tokenContractAddress = tokenRegistry.registeredTokens(
            commitmentMP.commitment.massMigrationMetaInfo.tokenID
        );
        IERC20 tokenContract = IERC20(tokenContractAddress);
        // transfer tokens from vault
        require(
            tokenContract.transferFrom(
                address(vault),
                address(this),
                commitmentMP.commitment.massMigrationMetaInfo.amount
            ),
            "token transfer failed"
        );
    }

    function ClaimTokens(uint256 token, uint256 accountID) external {
        address tokenContractAddress = tokenRegistry.registeredTokens(token);
        IERC20 tokenContract = IERC20(tokenContractAddress);

        // TODO validate accountID

        // transfer tokens from vault
        require(
            tokenContract.transfer(msg.sender, balances[accountID][token]),
            "token transfer failed"
        );
    }
}
