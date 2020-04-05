pragma solidity ^0.5.15;
import {ParamManager} from "./libs/ParamManager.sol";
import {NameRegistry as Registry} from "./NameRegistry.sol";
import {Tree as MerkleTree} from "./Tree.sol";
import {IncrementalTree} from "./IncrementalTree.sol";
import {DepositManager} from "./DepositManager.sol";
import {TestToken} from "./TestToken.sol";
import {Rollup} from "./Rollup.sol";
import {TokenRegistry} from "./TokenRegistry.sol";
import {Logger} from "./Logger.sol";


// Deployer is supposed to deploy new set of contracts while setting up all the utilities
// libraries and other auxiallry contracts like registry
contract Deployer {
    constructor() public {
        deployContracts();
    }

    function deployContracts() internal {
        Registry registry = new Registry();
        address nameRegistryAddr = address(registry);
        address balancesTree = address(new MerkleTree(nameRegistryAddr));
        registry.registerName(ParamManager.BALANCES_TREE(), balancesTree);
        // deploy accounts tree
        address accountsTree = address(new IncrementalTree(nameRegistryAddr));
        registry.registerName(ParamManager.ACCOUNTS_TREE(), accountsTree);

        // deposit manager
        address depositManager = address(new DepositManager(nameRegistryAddr));
        registry.registerName(ParamManager.DEPOSIT_MANAGER(), depositManager);

        address tokenRegistry = address(new TokenRegistry(nameRegistryAddr));
        registry.registerName(ParamManager.TOKEN_REGISTRY(), tokenRegistry);

        address logger = address(new Logger());
        registry.registerName(ParamManager.LOGGER(), logger);

        // deploy core rollup contract
        address rollup = address(new Rollup(nameRegistryAddr));
        registry.registerName(ParamManager.ROLLUP_CORE(), rollup);
    }
}
