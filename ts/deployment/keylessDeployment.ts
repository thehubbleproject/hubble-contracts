import { BigNumber, ethers, Signer } from "ethers";
import {
    Transaction,
    UnsignedTransaction,
    serialize,
    parse
} from "@ethersproject/transactions";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import { logDeployment, logTx } from "../../scripts/logger";
import { KEYLESS_DEPLOYMENT } from "./static";

const zero = BigNumber.from(0);

// r and s are arbitrary random hexes
const signature: SignatureLike = {
    v: 27,
    r: "0x0001abb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1e",
    s: "0x0002abb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1e"
};

export class KeylessDeployer {
    public readonly unsignedTx: UnsignedTransaction;
    public readonly rawDeploymentTx: string;
    public readonly deploymentTx: Transaction;
    public readonly keylessAccount: string;
    public readonly contractAddress: string;
    private provider?: Provider;

    constructor(
        public readonly bytecode: string,
        private readonly gasPrice: BigNumber = KEYLESS_DEPLOYMENT.GAS_PRICE,
        private readonly gasLimit: BigNumber = KEYLESS_DEPLOYMENT.GAS_LIMIT
    ) {
        this.unsignedTx = {
            chainId: 0, // If the chain ID is 0 or null, then EIP-155 is disabled and legacy signing is used, unless overridden in a signature.
            nonce: 0,
            gasPrice: this.gasPrice,
            value: zero,
            data: this.bytecode,
            gasLimit: this.gasLimit
        };
        this.rawDeploymentTx = serialize(this.unsignedTx, signature);
        this.deploymentTx = parse(this.rawDeploymentTx);
        if (!this.deploymentTx.from) throw new Error("No tx.from");
        this.keylessAccount = this.deploymentTx.from;
        this.contractAddress = ethers.utils.getContractAddress({
            from: this.keylessAccount,
            nonce: 0
        });
    }
    connect(provider: Provider) {
        this.provider = provider;
        return this;
    }

    async estimateGas() {
        if (!this.provider)
            throw new Error("Please connect to a provider first");
        return await this.provider.estimateGas(
            this.deploymentTx as TransactionRequest
        );
    }
    async alreadyDeployed(): Promise<boolean> {
        if (!this.provider)
            throw new Error("Please connect to a provider first");
        const code = await this.provider.getCode(this.contractAddress);
        return code != "0x";
    }

    private async fundKeylessAccount(feeder: Signer) {
        const ethAmtForDeployment = this.gasLimit.mul(this.gasPrice);
        return await feeder.sendTransaction({
            to: this.keylessAccount,
            value: ethAmtForDeployment
        });
    }
    private async deploy() {
        if (!this.provider)
            throw new Error("Please connect to a provider first");
        return await this.provider.sendTransaction(this.rawDeploymentTx);
    }
    async fundAndDeploy(feeder: Signer, verbose = false) {
        if (!this.provider) {
            if (!feeder.provider) throw new Error("No provider");
            this.provider = feeder.provider;
        }
        const feedTx = await this.fundKeylessAccount(feeder);
        logTx(verbose, "Tx: waiting, keyless account feed", feedTx.hash);
        await feedTx.wait();
        logTx(verbose, "Tx: keyless account is feeded", feedTx.hash);
        const deployTx = await this.deploy();
        logTx(verbose, "Tx: waiting, keyless depleyment", deployTx.hash);
        const receipt = await deployTx.wait();
        logDeployment(
            verbose,
            "Deployed: keyless",
            deployTx.hash,
            receipt.contractAddress
        );
        return receipt;
    }
}
