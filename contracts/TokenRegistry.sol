pragma solidity ^0.6.12;

interface ITokenRegistry {
    event RegisteredToken(uint256 tokenID, address tokenContract);
    event RegistrationRequest(address tokenContract);

    function safeGetAddress(uint256 tokenID) external view returns (address);

    function requestRegistration(address tokenContract) external;

    function finaliseRegistration(address tokenContract) external;
}

contract TokenRegistry is ITokenRegistry {
    mapping(address => bool) public pendingRegistrations;
    mapping(uint256 => address) private registeredTokens;

    uint256 public nextTokenID = 0;

    function safeGetAddress(uint256 tokenID)
        external
        view
        override
        returns (address)
    {
        address tokenContract = registeredTokens[tokenID];
        require(
            tokenContract != address(0),
            "TokenRegistry: Unregistered tokenID"
        );
        return tokenContract;
    }

    /**
     * @notice Requests addition of a new token to the chain, can be called by anyone
     * @param tokenContract Address for the new token being added
     */
    function requestRegistration(address tokenContract) public override {
        require(
            !pendingRegistrations[tokenContract],
            "Token already registered."
        );
        pendingRegistrations[tokenContract] = true;
        emit RegistrationRequest(tokenContract);
    }

    /**
     * @notice Add new tokens to the rollup chain by assigning them an tokenID
     * @param tokenContract Deposit tree depth or depth of subtree that is being deposited
     * TODO: add a modifier to allow only coordinator
     */
    function finaliseRegistration(address tokenContract) public override {
        require(
            pendingRegistrations[tokenContract],
            "Token was not registered"
        );
        registeredTokens[nextTokenID] = tokenContract; // tokenID => token contract address
        emit RegisteredToken(nextTokenID, tokenContract);
        nextTokenID++;
    }
}
