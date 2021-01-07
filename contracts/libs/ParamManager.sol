pragma solidity ^0.5.15;

library ParamManager {
    function depositManager() public pure returns (bytes32) {
        // keccak256("deposit_manager")
        return
            hex"a1d7caabcceec72bfb8870f1117a764f97ffaae5323cca64935467229b742207";
    }

    function withdrawManager() public pure returns (bytes32) {
        // keccak256("withdraw_manager");
        return
            hex"7510029c1a90fc521ff8fe151dec2d580d248f5e3d33ea9b712dca09bc208d21";
    }

    function exampleToken() public pure returns (bytes32) {
        // keccak256("example_token");
        return
            hex"517d3d66ecffa2b27864225920fee991d03bbc7c10d30bbeb6cc3069907ff9a0";
    }

    function chooser() public pure returns (bytes32) {
        // keccak256("chooser");
        return
            hex"35f796fdeffdbe871408b4a23a940c5a4ebcefd7a0e58376124e7a3deca98c6a";
    }

    function rollupCore() public pure returns (bytes32) {
        // keccak256("rollup_core");
        return
            hex"fa022f320169fdd3118ef654b66ba96e2c6ee964da2f4fcfac37865a21b6dc47";
    }

    function accountRegistry() public pure returns (bytes32) {
        // keccak256("account_registry");
        return
            hex"636eef3f2cb6d1d0f3845c4ab7455b65927da384eaa5ce09871c63728c559557";
    }

    function tokenRegistry() public pure returns (bytes32) {
        // keccak256("token_registry");
        return
            hex"726357bb6d2e726eeebe528904057fd7179ea9f65048fc2a62edc8c17cca2594";
    }

    function transferSimple() public pure returns (bytes32) {
        // keccak256("transfer");
        return
            hex"b483afd3f4caedc6eebf44246fe54e38c95e3179a5ec9ea81740eca5b482d12e";
    }

    function massMigration() public pure returns (bytes32) {
        // keccak256("mass_migs");
        return
            hex"9e0c9c05756df92485d6d9fcc8bf645cb1c81954f826ca9da27cd2e6a22a4ea2";
    }

    function create2Transfer() public pure returns (bytes32) {
        // keccak256("create2transfer");
        return
            hex"4f1d0b1935cdb1bd19ab523a660060eaa57e5e5c8210d19089d3be6c340c7fdf";
    }

    function spokeRegistry() public pure returns (bytes32) {
        // keccak256("spoke_registry");
        return
            hex"cd44b661335da98357cc1bd9a0de57d15aa7d7174b8da25b003cd127683311a9";
    }

    function vault() public pure returns (bytes32) {
        // keccak256("vault");
        return
            hex"23c14fceac7676b670aa56866076586ea1ce15ddcf19208ec6346cf748dffbee";
    }
}
