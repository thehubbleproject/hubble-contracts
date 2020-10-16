pragma solidity ^0.5.15;

library ParamManager {
    function depositManager() public pure returns (bytes32) {
        return keccak256("deposit_manager");
    }

    function withdrawManager() public pure returns (bytes32) {
        return keccak256("withdraw_manager");
    }

    function testToken() public pure returns (bytes32) {
        return keccak256("test_token");
    }

    function proofOfBurn() public pure returns (bytes32) {
        return keccak256("pob");
    }

    function governance() public pure returns (bytes32) {
        return keccak256("governance");
    }

    function rollupCore() public pure returns (bytes32) {
        return keccak256("rollup_core");
    }

    function accountRegistry() public pure returns (bytes32) {
        return keccak256("account_registry");
    }

    function logger() public pure returns (bytes32) {
        return keccak256("logger");
    }

    function merkleUtils() public pure returns (bytes32) {
        return keccak256("merkle_lib");
    }

    function paramManager() public pure returns (bytes32) {
        return keccak256("param_manager");
    }

    function tokenRegistry() public pure returns (bytes32) {
        return keccak256("token_registry");
    }

    function transferSimple() public pure returns (bytes32) {
        return keccak256("transfer");
    }

    function massMigration() public pure returns (bytes32) {
        return keccak256("mass_migs");
    }

    function spokeRegistry() public pure returns (bytes32) {
        return keccak256("spoke_registry");
    }

    function vault() public pure returns (bytes32) {
        return keccak256("vault");
    }

    bytes32 public constant _CHAIN_ID = keccak256("hubble-123");

    function chainID() public pure returns (bytes32) {
        return _CHAIN_ID;
    }
}
