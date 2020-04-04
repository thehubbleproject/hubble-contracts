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
    // deploy token registry
    Registry registry = new Registry();

    // // deploy param manager
    // require(registry.registerName(registry.PARAM_MANAGER,parammanager.address),"cannot register param manager");

    // // deploy balances tree
    // MerkleTree BALANCES_TREE= new MerkleTree();
    // registry.registerName(registry.BALANCES_TREE,balancesTree.address);

    // // deploy accounts tree
    // IncrementalTree accountsTree =  new IncrementalTree();
    // registry.registerName(registry.ACCOUNTS_TREE,accountsTree.address);

    // // deposit manager
    // DepositManager depositManager = new DepositManager();
    // registry.registerName(registry.DEPOSIT_MANAGER,depositManager.address);

    // // withdraw manager
    // WithdrawManager withdrawManager = new WithdrawManager();
    // registry.registerName(registry.WITHDRAW_MANAGER,withdrawManager.address);

    // // deploy test token
    // TestToken testToken = new TestToken();
    // registry.registerName(registry.TEST_TOKEN,testToken.address);

    // TokenRegistry tokenRegistry = new TokenRegistry();
    // registry.registerName(registry.TOKEN_REGISTRY,tokenRegistry.address);

    // Logger logger = new Logger();
    // registry.registerName(registry.LOGGER,logger.address);

    // // deploy core rollup contract
    // Rollup rollup = new Rollup();
    // registry.registerName(registry.ROLLUP_CORE,rollup.address);
}
