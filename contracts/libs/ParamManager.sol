pragma solidity ^0.5.15;


library ParamManager {
    function DEPOSIT_MANAGER() public pure returns (bytes32) {
        return keccak256("deposit_manager");
    }

    function WITHDRAW_MANAGER() public pure returns (bytes32) {
        return keccak256("withdraw_manager");
    }

    function TEST_TOKEN() public pure returns (bytes32) {
        return keccak256("test_token");
    }

    function ROLLUP_CORE() public pure returns (bytes32) {
        return keccak256("rollup_core");
    }

    function ACCOUNTS_TREE() public pure returns (bytes32) {
        return keccak256("accounts_tree");
    }

    function BALANCES_TREE() public pure returns (bytes32) {
        return keccak256("balances_tree");
    }

    function LOGGER() public pure returns (bytes32) {
        return keccak256("logger");
    }

    function MERKLE_UTILS() public pure returns (bytes32) {
        return keccak256("merkle_lib");
    }

    function PARAM_MANAGER() public pure returns (bytes32) {
        return keccak256("param_manager");
    }

    function TOKEN_REGISTRY() public pure returns (bytes32) {
        return keccak256("token_registry");
    }

    uint8 public constant _MAX_DEPTH = 2;

    function MAX_DEPTH() public pure returns (uint8) {
        return _MAX_DEPTH;
    }

    bytes32 public constant _CHAIN_ID = keccak256("opru-123");

    function CHAIN_ID() public pure returns (bytes32) {
        return _CHAIN_ID;
    }

    // finalisation time is the number of blocks required by a batch to finalise
    // Delay period = 7 days. Block time = 15 seconds
    uint256 public constant _TIME_TO_FINALISE = 7 days;

    function TIME_TO_FINALISE() public pure returns (uint256) {
        return _TIME_TO_FINALISE;
    }

    // min gas required before rollback pauses
    uint256 public constant _MIN_GAS_LIMIT_LEFT = 100000;

    function MIN_GAS_LIMIT_LEFT() public pure returns (uint256) {
        return _MIN_GAS_LIMIT_LEFT;
    }

    uint256 public constant _MAX_TXS_PER_BATCH = 10;

    function MAX_TXS_PER_BATCH() public pure returns (uint256) {
        return _MAX_TXS_PER_BATCH;
    }

    uint256 public constant _STAKE_AMOUNT = 32;

    function STAKE_AMOUNT() public pure returns (uint256) {
        return _STAKE_AMOUNT;
    }

    address payable constant _BURN_ADDRESS = 0x0000000000000000000000000000000000000000;

    function BURN_ADDRESS() public pure returns (address payable) {
        return _BURN_ADDRESS;
    }

    bytes32 public constant _ZERO_BYTES32 = 0x0000000000000000000000000000000000000000000000000000000000000000;

    function ZERO_BYTES32() public pure returns (bytes32) {
        return _ZERO_BYTES32;
    }
}
