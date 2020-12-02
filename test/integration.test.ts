import { assert } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { allContracts } from "../ts/allContractsInterfaces";
import { PRODUCTION_PARAMS } from "../ts/constants";
import { deployAll } from "../ts/deploy";
import { UserStateFactory } from "../ts/factory";
import { DeploymentParameters } from "../ts/interfaces";
import { StateTree } from "../ts/stateTree";
import { TestTokenFactory } from "../types/ethers-contracts";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";

describe("Integration Test", function() {
    let contracts: allContracts;
    let stateTree: StateTree
    let parameters: DeploymentParameters
    let deployer: Signer
    let coordinator: Signer

    before(async function() {
        [deployer, coordinator] = await ethers.getSigners();
        parameters = PRODUCTION_PARAMS
        stateTree = StateTree.new(parameters.MAX_DEPTH);
        parameters.GENESIS_STATE_ROOT = stateTree.root;
        contracts = await deployAll(deployer, parameters);
    });
    it("Register another token", async function (){
        const {tokenRegistry} = contracts
        const tokenContract = await new TestTokenFactory(deployer).deploy()
        await tokenRegistry.requestRegistration(tokenContract.address)
        const tx = await tokenRegistry.finaliseRegistration(tokenContract.address)
        const [event] = await tokenRegistry.queryFilter(
            tokenRegistry.filters.RegisteredToken(null, null),
            tx.blockHash
        );
        // In the deploy script, we already have a TestToken registered with tokenID 1
        assert.equal(event.args?.tokenType, 2)

    })
    it("Coordinator bid the first auction", async function () {
        const chooser = contracts.chooser as BurnAuction
        await chooser.connect(coordinator).bid({value: "1"})
    })
    it("Deposit some users", async function () {
        // UserStateFactory.buildList()
    });
    it("Users doing Transfers");
    it("Getting new users via Create to transfer");
    it("Exit via mass migration");
    it("Users withdraw funds");
    it("Coordinator withdrew their stack");
});
