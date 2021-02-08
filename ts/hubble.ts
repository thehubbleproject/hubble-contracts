import { allContracts } from "./allContractsInterfaces";
import { DeploymentParameters } from "./interfaces";
import fs from "fs";
import {
    BlsAccountRegistryFactory,
    BurnAuctionFactory,
    Create2TransferFactory,
    DepositManagerFactory,
    ExampleTokenFactory,
    FrontendCreate2TransferFactory,
    FrontendGenericFactory,
    FrontendMassMigrationFactory,
    FrontendTransferFactory,
    MassMigrationFactory,
    ProofOfBurnFactory,
    RollupFactory,
    SpokeRegistryFactory,
    TokenRegistryFactory,
    TransferFactory,
    VaultFactory,
    WithdrawManagerFactory
} from "../types/ethers-contracts";
import { ethers, Signer } from "ethers";
import { solG2 } from "./mcl";
import { toWei } from "./utils";
import { StateProvider, StateTree } from "./stateTree";
import { Tx, TxTransfer } from "./tx";

function parseGenesis(
    parameters: DeploymentParameters,
    addresses: { [key: string]: string },
    signer: Signer
): allContracts {
    const factories = {
        frontendGeneric: FrontendGenericFactory,
        frontendTransfer: FrontendTransferFactory,
        frontendMassMigration: FrontendMassMigrationFactory,
        frontendCreate2Transfer: FrontendCreate2TransferFactory,
        blsAccountRegistry: BlsAccountRegistryFactory,
        tokenRegistry: TokenRegistryFactory,
        transfer: TransferFactory,
        massMigration: MassMigrationFactory,
        create2Transfer: Create2TransferFactory,
        exampleToken: ExampleTokenFactory,
        spokeRegistry: SpokeRegistryFactory,
        vault: VaultFactory,
        depositManager: DepositManagerFactory,
        rollup: RollupFactory,
        withdrawManager: WithdrawManagerFactory,
        chooser: parameters.USE_BURN_AUCTION
            ? BurnAuctionFactory
            : ProofOfBurnFactory
    };
    const contracts: any = {};
    for (const [key, factory] of Object.entries(factories)) {
        const address = addresses[key];
        if (!address) throw `Bad Genesis: Find no address for ${key} contract`;
        contracts[key] = factory.connect(address, signer);
    }
    return contracts;
}

function compare(a: TxTransfer, b: TxTransfer) {
    if (a.fee.lt(b.fee)) {
        return -1;
    }
    if (a.fee.gt(b.fee)) {
        return 1;
    }
    // a must be equal to b
    return 0;
}

class TxPool {
    private heap: TxTransfer[];
    constructor() {
        this.heap = [];
    }
    get size() {
        return this.heap.length;
    }
    add(tx: TxTransfer) {
        this.heap.push(tx);
    }
    pick(n: number) {
        this.heap.sort(compare);
        const result = [];
        for (let i = 0; i < n; i++) {
            result.push(this.heap.pop());
        }
        return result;
    }
}

export class Hubble {
    public stateTree: StateTree;
    public txpool: TxPool;
    private constructor(
        public parameters: DeploymentParameters,
        public contracts: allContracts,
        public signer: Signer
    ) {
        this.stateTree = new StateTree(parameters.MAX_DEPTH);
        this.txpool = new TxPool();
    }
    static fromGenesis(
        parameters: DeploymentParameters,
        addresses: { [key: string]: string },
        signer: Signer
    ) {
        const contracts = parseGenesis(parameters, addresses, signer);
        return new Hubble(parameters, contracts, signer);
    }

    static fromDefault(
        providerUrl = "http://localhost:8545",
        genesisPath = "./genesis.json"
    ) {
        const genesis = fs.readFileSync(genesisPath).toString();
        const { parameters, addresses, axiliary } = JSON.parse(genesis);
        const provider = new ethers.providers.JsonRpcProvider(providerUrl);
        const signer = provider.getSigner();
        return Hubble.fromGenesis(parameters, addresses, signer);
    }

    getState(stateID: number) {
        return this.stateTree.getState(stateID).state;
    }

    async registerPublicKeys(pubkeys: string[]) {
        const registry = this.contracts.blsAccountRegistry;
        const accountIDs: number[] = [];
        console.log(`Registering ${pubkeys.length} public keys`);
        for (const pubkeyRaw of pubkeys) {
            const parsedPubkey: solG2 = [
                "0x" + pubkeyRaw.slice(64, 128),
                "0x" + pubkeyRaw.slice(0, 64),
                "0x" + pubkeyRaw.slice(192, 256),
                "0x" + pubkeyRaw.slice(128, 192)
            ];
            console.log("Registering", parsedPubkey);
            const accID = await registry.callStatic.register(parsedPubkey);
            const tx = await registry.register(parsedPubkey);
            await tx.wait();
            accountIDs.push(accID.toNumber());
            console.log(
                "Done registering pubkey",
                pubkeyRaw.slice(0, 5),
                accID.toNumber()
            );
        }
        return accountIDs;
    }
    async depositFor(pubkeyIDs: number[], tokenID: number, amount: number) {
        console.log(
            `Depositing tokenID ${tokenID} for pubkeyID ${pubkeyIDs} each with amount ${amount}`
        );
        const { tokenRegistry, depositManager } = this.contracts;
        const tokenAddress = await tokenRegistry.safeGetAddress(tokenID);
        const erc20 = ExampleTokenFactory.connect(tokenAddress, this.signer);
        // approve depositmanager for amount
        const totalAmount = pubkeyIDs.length * amount;
        console.log("Approving total amount", totalAmount);
        const approveTx = await erc20.approve(
            depositManager.address,
            toWei(totalAmount.toString())
        );
        await approveTx.wait();

        console.log("token approved", approveTx.hash.toString());

        for (const pubkeyID of pubkeyIDs) {
            console.log(`Depositing ${amount} for pubkeyID ${pubkeyID}`);
            const tx = await depositManager.depositFor(
                pubkeyID,
                amount,
                tokenID
            );
            await tx.wait();
        }
    }
}
