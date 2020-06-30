pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;
import {IncrementalTree} from "./IncrementalTree.sol";
import {Types} from "./libs/Types.sol";
import {Logger} from "./logger.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";
import {MerkleTreeUtils as MTUtils} from "./MerkleTreeUtils.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {ITokenRegistry} from "./interfaces/ITokenRegistry.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ParamManager} from "./libs/ParamManager.sol";
import {POB} from "./POB.sol";
import {Governance} from "./Governance.sol";
import {Rollup} from "./rollup.sol";

contract DepositManager {
    MTUtils public merkleUtils;
    Registry public nameRegistry;
    bytes32[] public pendingDeposits;
    mapping(uint256 => bytes32) pendingFilledSubtrees;
    uint256 public firstElement = 1;
    uint256 public lastElement = 0;

    uint256 public depositSubTreesPackaged = 0;

    function enqueue(bytes32 newDepositSubtree) public {
        lastElement += 1;
        pendingFilledSubtrees[lastElement] = newDepositSubtree;
        depositSubTreesPackaged++;
    }

    function dequeue() public returns (bytes32 depositSubtreeRoot) {
        require(lastElement >= firstElement); // non-empty queue
        depositSubtreeRoot = pendingFilledSubtrees[firstElement];
        delete pendingFilledSubtrees[firstElement];
        firstElement += 1;
        depositSubTreesPackaged--;
    }

    uint256 public queueNumber;
    uint256 public depositSubtreeHeight;
    Governance public governance;
    Logger public logger;
    ITokenRegistry public tokenRegistry;
    IERC20 public tokenContract;
    IncrementalTree public accountsTree;

    bytes32
        public constant ZERO_BYTES32 = 0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563;

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.POB())
        );
        assert(msg.sender == pobContract.getCoordinator());
        _;
    }

    modifier onlyRollup() {
        assert(
            msg.sender ==
                nameRegistry.getContractDetails(ParamManager.ROLLUP_CORE())
        );
        _;
    }

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
        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
        accountsTree = IncrementalTree(
            nameRegistry.getContractDetails(ParamManager.ACCOUNTS_TREE())
        );

        AddCoordinatorLeaves();
    }

    function AddCoordinatorLeaves() internal {
        // first leaf in the incremental tree belongs to the coordinator
        accountsTree.appendLeaf(ZERO_BYTES32);
        accountsTree.appendLeaf(ZERO_BYTES32);
    }

    /**
     * @notice Adds a deposit for the msg.sender to the deposit queue
     * @param _amount Number of tokens that user wants to deposit
     * @param _tokenType Type of token user is depositing
     */
    function deposit(
        uint256 _amount,
        uint256 _tokenType,
        bytes memory _pubkey
    ) public {
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

            pendingDeposits[pendingDeposits.length - 2] = merkleUtils.getParent(
                deposits[0],
                deposits[1]
            );

            // remove 1 deposit from the pending deposit queue
            removeDeposit(pendingDeposits.length - 1);
            tmp = tmp / 2;

            // update the temp deposit subtree height
            tmpDepositSubtreeHeight++;

            // thow event for the coordinator
            logger.logDepositLeafMerged(
                deposits[0],
                deposits[1],
                pendingDeposits[0]
            );
        }

        if (tmpDepositSubtreeHeight > depositSubtreeHeight) {
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }

        if (depositSubtreeHeight == governance.MAX_DEPOSIT_SUBTREE()) {
            // start adding deposits to prepackaged deposit subtree root queue
            enqueue(pendingDeposits[0]);

            // emit an event to signal that a package is ready
            // isnt really important for anyone tho
            logger.logDepositSubTreeReady(pendingDeposits[0]);

            // update the number of items in pendingDeposits
            queueNumber = queueNumber - 2**depositSubtreeHeight;

            // empty the pending deposits queue
            removeDeposit(0);

            // reset deposit subtree height
            depositSubtreeHeight = 0;
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
        Types.AccountMerkleProof memory _zero_account_mp,
        bytes32 latestBalanceTree
    ) public onlyRollup returns (bytes32) {
        bytes32 emptySubtreeRoot = merkleUtils.getRoot(_subTreeDepth);

        // from mt proof we find the root of the tree
        // we match the root to the balance tree root on-chain
        bool isValid = merkleUtils.verifyLeaf(
            latestBalanceTree,
            emptySubtreeRoot,
            _zero_account_mp.accountIP.pathToAccount,
            _zero_account_mp.siblings
        );

        require(isValid, "proof invalid");

        // just dequeue from the pre package deposit subtrees
        bytes32 depositsSubTreeRoot = dequeue();

        // emit the event
        logger.logDepositFinalised(
            depositsSubTreeRoot,
            _zero_account_mp.accountIP.pathToAccount
        );

        // return the updated merkle tree root
        return (depositsSubTreeRoot);
    }

    /**
     * @notice Removes a deposit from the pendingDeposits queue and shifts the queue
     * @param _index Index of the element to remove
     * @return Remaining elements of the array
     */
    function removeDeposit(uint256 _index) internal {
        require(
            _index < pendingDeposits.length,
            "array index is out of bounds"
        );

        // if we want to nuke the queue
        if (_index == 0) {
            uint256 numberOfDeposits = pendingDeposits.length;
            for (uint256 i = 0; i < numberOfDeposits; i++) {
                delete pendingDeposits[i];
            }
            pendingDeposits.length = 0;
            return;
        }

        if (_index == pendingDeposits.length - 1) {
            delete pendingDeposits[pendingDeposits.length - 1];
            pendingDeposits.length--;
            return;
        }
    }
}
