pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import {IncrementalTree} from "./IncrementalTree.sol";
import {Types} from "./libs/Types.sol";
import {Logger} from "./Logger.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {Tree as MerkleTree} from "./Tree.sol";
import {ParamManager} from "./libs/ParamManager.sol";


contract DepositManager {
    MTUtils public merkleUtils;
    Registry public nameRegistry;
    MerkleTree public balancesTree;
    bytes32[] public pendingDeposits;
    uint256 public queueNumber;
    uint256 public depositSubtreeHeight;
    Logger public logger;
    address public Coordinator;
    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;
    IncrementalTree public accountsTree;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);
        merkleUtils = MTUtils(
            nameRegistry.getContractDetails(ParamManager.MERKLE_UTILS())
        );
        tokenRegistry = ITokenRegistry(
            nameRegistry.getContractDetails(ParamManager.TOKEN_REGISTRY())
        );
        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
        accountsTree = IncrementalTree(
            nameRegistry.getContractDetails(ParamManager.ACCOUNTS_TREE())
        );
        balancesTree = MerkleTree(
            nameRegistry.getContractDetails(ParamManager.BALANCES_TREE())
        );
    }

    /**
     * @notice Adds a deposit for the msg.sender to the deposit queue
     * @param _amount Number of tokens that user wants to deposit
     * @param _tokenType Type of token user is depositing
     */
    function deposit(uint256 _amount, uint256 _tokenType, bytes memory _pubkey)
        public
    {
        depositFor(msg.sender, _amount, _tokenType, _pubkey);
    }

    /**
     * @notice Adds a deposit for an address to the deposit queue
     * @param _destination Address for which we are depositing
     * @param _amount Number of tokens that user wants to deposit
     * @param _tokenType Type of token user is depositing
     */
    function depositFor(
        address _destination,
        uint256 _amount,
        uint256 _tokenType,
        bytes memory _pubkey
    ) public {
        // check amount is greater than 0
        require(_amount > 0, "token deposit must be greater than 0");

        // ensure public matches the destination address
        require(
            _destination == RollupUtils.calculateAddress(_pubkey),
            "public key and address don't match"
        );

        // check token type exists
        address tokenContractAddress = tokenRegistry.registeredTokens(
            _tokenType
        );
        tokenContract = IERC20(tokenContractAddress);

        // transfer from msg.sender to this contract
        require(
            tokenContract.transferFrom(msg.sender, address(this), _amount),
            "token transfer not approved"
        );

        // Add pubkey to PDA tree
        Types.PDALeaf memory newPDALeaf;
        newPDALeaf.pubkey = _pubkey;

        // returns leaf index upon successfull append
        uint256 accID = accountsTree.appendLeaf(
            RollupUtils.PDALeafToHash(newPDALeaf)
        );

        // create a new account
        Types.UserAccount memory newAccount;
        newAccount.balance = _amount;
        newAccount.tokenType = _tokenType;
        newAccount.nonce = 0;
        newAccount.ID = accID;

        // get new account hash
        bytes32 accountHash = RollupUtils.HashFromAccount(newAccount);

        // queue the deposit
        pendingDeposits.push(accountHash);

        // emit the event
        logger.logDepositQueued(
            accID,
            _destination,
            _amount,
            _tokenType,
            accountHash,
            _pubkey
        );

        queueNumber++;
        uint256 tmpDepositSubtreeHeight = 0;
        uint256 tmp = queueNumber;
        while (tmp % 2 == 0) {
            bytes32[] memory deposits = new bytes32[](2);
            deposits[0] = pendingDeposits[pendingDeposits.length - 2];
            deposits[1] = pendingDeposits[pendingDeposits.length - 1];

            pendingDeposits[pendingDeposits.length - 2] = RollupUtils
                .getDepositsHash(deposits[0], deposits[1]);
            removeDeposit(pendingDeposits.length - 1);
            tmp = tmp / 2;
            tmpDepositSubtreeHeight++;
        }
        if (tmpDepositSubtreeHeight > depositSubtreeHeight) {
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }
    }

    /**
     * @notice Merges the deposit tree with the balance tree by
     *        superimposing the deposit subtree on the balance tree
     * @param _subTreeDepth Deposit tree depth or depth of subtree that is being deposited
     * @param _zero_account_mp Merkle proof proving the node at which we are inserting the deposit subtree consists of all empty leaves
     * @return Updates in-state merkle tree root
     */
    function finaliseDeposits(
        uint256 _subTreeDepth,
        Types.AccountMerkleProof memory _zero_account_mp
    ) public returns (bytes32) {
        bytes32 emptySubtreeRoot = merkleUtils.getRoot(_subTreeDepth);
        // from mt proof we find the root of the tree
        // we match the root to the balance tree root on-chain
        require(
            merkleUtils.verifyLeaf(
                balancesTree.getRoot(),
                emptySubtreeRoot,
                _zero_account_mp.accountIP.pathToAccount,
                _zero_account_mp.siblings
            ),
            "proof invalid"
        );

        // update the in-state balance tree with new leaf from pendingDeposits[0]
        balancesTree.updateLeaf(
            pendingDeposits[0],
            _zero_account_mp.accountIP.pathToAccount
        );

        // removed the root at pendingDeposits[0] because it has been added to the balance tree
        removeDeposit(0);

        // update the number of elements present in the queue
        queueNumber = queueNumber - 2**depositSubtreeHeight;

        // return the updated merkle tree root
        return balancesTree.getRoot();
    }

    /**
     * @notice Removes a deposit from the pendingDeposits queue and shifts the queue
     * @param _index Index of the element to remove
     * @return Remaining elements of the array
     */
    function removeDeposit(uint256 _index) internal returns (bytes32[] memory) {
        require(
            _index < pendingDeposits.length,
            "array index is out of bounds"
        );

        for (uint256 i = _index; i < pendingDeposits.length - 1; i++) {
            pendingDeposits[i] = pendingDeposits[i + 1];
        }
        delete pendingDeposits[pendingDeposits.length - 1];
        pendingDeposits.length--;
        return pendingDeposits;
    }
}
