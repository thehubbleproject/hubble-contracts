pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import { Types } from "./libs/Types.sol";
import { RollupUtils } from "./libs/RollupUtils.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { ITokenRegistry } from "./interfaces/ITokenRegistry.sol";
import { IERC20 } from "./interfaces/IERC20.sol";
import { Tx } from "./libs/Tx.sol";
import { MerkleTreeUtils as MTUtils } from "./MerkleTreeUtils.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { POB } from "./POB.sol";
import { Governance } from "./Governance.sol";
import { Rollup } from "./rollup.sol";
import { SpokeRegistry } from "./SpokeRegistry.sol";
import { DepositManager } from "./DepositManager.sol";

contract WithdrawManager {
    using Tx for bytes;
    MTUtils public merkleUtils;
    Registry public nameRegistry;
    Rollup public rollup;
    SpokeRegistry public spokes;
    mapping(uint256 => mapping(uint256 => uint256)) balances;
    ITokenRegistry public tokenRegistry;
    DepositManager public depositManager;

    /*********************
     * Constructor *
     ********************/
    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        rollup = Rollup(
            nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        spokes = SpokeRegistry(
            nameRegistry.getContractDetails(ParamManager.SPOKE_REGISTRY())
        );
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        depositManager = DepositManager(
            nameRegistry.getContractDetails(ParamManager.DEPOSIT_MANAGER())
        );
    }

    function ProcessWithdrawCommitment(
        uint256 _batch_id,
        Types.MMCommitmentInclusionProof calldata commitmentMP,
        bytes calldata txs
    ) external {
        Types.Batch memory withdrawBatch = rollup.getBatch(_batch_id);
        require(
            block.number > withdrawBatch.finalisesOn,
            "Batch not finalised"
        );
        // commitment is a mass migration commitment
        require(commitmentMP.commitment.batchType == Types.Usage.MassMigration);
        // we are the target spoke
        require(
            address(this) ==
                spokes.getSpokeAddress(
                    commitmentMP.commitment.massMigrationMetaInfo.targetSpokeID
                )
        );
        // txs are present in commitment
        require(commitmentMP.commitment.txHashCommitment == keccak256(txs));

        // check if commitment was submitted in the batch
        require(
            merkleUtils.verifyLeaf(
                withdrawBatch.commitmentRoot,
                RollupUtils.MMCommitmentToHash(
                    commitmentMP.commitment.stateRoot,
                    commitmentMP.commitment.accountRoot,
                    commitmentMP.commitment.txHashCommitment,
                    commitmentMP.commitment.massMigrationMetaInfo.tokenID,
                    commitmentMP.commitment.massMigrationMetaInfo.amount,
                    commitmentMP.commitment.massMigrationMetaInfo.withdrawRoot,
                    commitmentMP.commitment.massMigrationMetaInfo.targetSpokeID,
                    commitmentMP.commitment.signature
                ),
                commitmentMP.pathToCommitment,
                commitmentMP.siblings
            ),
            "Commitment not present in batch"
        );
        Tx.MassMig memory _tx;
        // read all transactions and make the transfers
        for (uint256 i = 0; i < txs.mass_mig_size(); i++) {
            _tx = txs.mass_migration_decode(i);
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
                address(depositManager),
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
