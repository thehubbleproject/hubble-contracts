pragma solidity >=0.4.21;

import { Logger } from "./logger.sol";
import { NameRegistry as Registry } from "./NameRegistry.sol";
import { ParamManager } from "./libs/ParamManager.sol";
import { POB } from "./POB.sol";

contract TokenRegistry {
    address public rollupNC;
    Logger public logger;
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) public registeredTokens;

    uint256 public numTokens;

    modifier onlyCoordinator() {
        POB pobContract = POB(
            nameRegistry.getContractDetails(ParamManager.POB())
        );
        assert(msg.sender == pobContract.getCoordinator());
        _;
    }
    Registry public nameRegistry;

    constructor(address _registryAddr) public {
        nameRegistry = Registry(_registryAddr);

        logger = Logger(nameRegistry.getContractDetails(ParamManager.LOGGER()));
    }

    /**
     * @notice Requests addition of a new token to the chain, can be called by anyone
     * @param tokenContract Address for the new token being added
     */
    function requestTokenRegistration(address tokenContract) public {
        require(
            pendingRegistrations[tokenContract] == false,
            "Token already registered."
        );
        pendingRegistrations[tokenContract] = true;
        logger.logRegistrationRequest(tokenContract);
    }

    /**
     * @notice Add new tokens to the rollup chain by assigning them an ID called tokenType from here on
     * @param tokenContract Deposit tree depth or depth of subtree that is being deposited
     * TODO: add a modifier to allow only coordinator
     */
    function finaliseTokenRegistration(address tokenContract) public {
        require(
            pendingRegistrations[tokenContract],
            "Token was not registered"
        );
        numTokens++;
        registeredTokens[numTokens] = tokenContract; // tokenType => token contract address
        logger.logRegisteredToken(numTokens, tokenContract);
    }
}
