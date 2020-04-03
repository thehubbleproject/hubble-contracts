pragma solidity ^0.5.0;

import {DataTypes as dataTypes} from "./DataTypes.sol";
import {Logger} from "./logger.sol";
import {RollupUtils} from "./libs/RollupUtils.sol";


contract DepositManager {
    bytes32[] public pendingDeposits;
    uint256 public queueNumber;
    uint256 public depositSubtreeHeight;
    Logger public logger;
    address public Coordinator;

    constructor(address _coordinator, address _logger) public {
        Coordinator = _coordinator;
        logger = Logger(_logger);
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
        dataTypes.PDALeaf memory newPDALeaf;
        newPDALeaf.pubkey = _pubkey;

        // returns leaf index upon successfull append
        uint256 accID = accountsTree.appendLeaf(PDALeafToHash(newPDALeaf));

        // create a new account
        dataTypes.UserAccount memory newAccount;
        newAccount.balance = _amount;
        newAccount.tokenType = _tokenType;
        newAccount.nonce = 0;
        newAccount.ID = accID;

        // get new account hash
        bytes32 accountHash = HashFromAccount(newAccount);

        // queue the deposit
        pendingDeposits.push(accountHash);

        // emit the event
        logger.logDepositQueued(
            1,
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

            pendingDeposits[pendingDeposits.length - 2] = getDepositsHash(
                deposits[0],
                deposits[1]
            );
            removeDeposit(pendingDeposits.length - 1);
            tmp = tmp / 2;
            tmpDepositSubtreeHeight++;
        }
        if (tmpDepositSubtreeHeight > depositSubtreeHeight) {
            depositSubtreeHeight = tmpDepositSubtreeHeight;
        }
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
