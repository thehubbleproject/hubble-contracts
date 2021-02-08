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
import { serialize, Tx, TxTransfer } from "./tx";
import { TransferBatch, TransferCommitment } from "./commitments";
import { ZERO_BYTES32 } from "./constants";
import { aggregate, SignatureInterface } from "./blsSigner";
import { BurnAuction } from "../types/ethers-contracts/BurnAuction";

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
    pick(n: number): TxTransfer[] {
        this.heap.sort(compare);
        const result: TxTransfer[] = [];
        const resultSize = Math.min(n, this.heap.length);
        for (let i = 0; i < resultSize; i++) {
            result.push(this.heap.pop() as TxTransfer);
        }
        return result;
    }
}

interface Context {
    currentSlot: number;
}

export class Hubble {
    public stateTree: StateTree;
    public txpool: TxPool;
    public context: Context;
    private constructor(
        public parameters: DeploymentParameters,
        public contracts: allContracts,
        public signer: Signer
    ) {
        this.stateTree = new StateTree(parameters.MAX_DEPTH);
        this.txpool = new TxPool();
        this.context = { currentSlot: -1 };
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
    async bid() {
        const burnAuction = this.contracts.chooser as BurnAuction;
        const currentSlot = await burnAuction.currentSlot();
        if (currentSlot > this.context.currentSlot) {
            console.log("New slot", currentSlot);
            this.context.currentSlot = currentSlot;
            const value = "1";
            await burnAuction.bid(value, { value });
            console.log("Bid", value);
        }
    }

    async aggregate() {
        const maxBatchSize = 32;
        const commits = [];
        for (let i = 0; i < maxBatchSize; i++) {
            const txs = this.txpool.pick(this.parameters.MAX_TXS_PER_COMMIT);

            if (txs.length == 0) break;
            const aggsig = aggregate(
                txs.map(tx => tx?.signature as SignatureInterface)
            );
            const commit = TransferCommitment.new(
                ZERO_BYTES32,
                ZERO_BYTES32,
                aggsig.sol,
                0,
                serialize(txs)
            );
            commits.push(commit);
            console.log("Packing", txs.length, "txs");
        }
        const batch = new TransferBatch(commits);
        const chooser = this.contracts.chooser as BurnAuction;
        let proposer = "";
        try {
            proposer = await chooser.getProposer();
        } catch (error) {
            if (error.message.includes("Auction has not been initialized")) {
                console.warn("Auction has not been initialized");
            }
        }

        if (proposer == (await this.signer.getAddress())) {
            console.info("We are a proposer, can propose");
            await batch.submit(
                this.contracts.rollup,
                this.parameters.STAKE_AMOUNT
            );
        } else {
            console.info("We are not a proposer, skip this slot");
        }
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
