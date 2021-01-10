import { BigNumber, ethers, Signer } from "ethers";
import {
    Transaction,
    UnsignedTransaction,
    serialize,
    parse
} from "@ethersproject/transactions";
import { SignatureLike } from "@ethersproject/bytes";
import { Provider, TransactionReceipt } from "@ethersproject/providers";
import assert from "assert";
import { logAddress, logDeployment, logTx } from "../../scripts/logger";

const zero = BigNumber.from(0);

const signature: SignatureLike = {
    v: 27,
    r: "0x0001abb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1e",
    s: "0x0002abb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1eabb1e"
};

export interface KeylessDeployment {
    keylessAccount: string;
    contractAddress: string;
    alreadyDeployed: boolean;
    estimatedGasCost: BigNumber;
    rawTx: string;
}

export interface KeylessDeploymentResult extends KeylessDeployment {
    receipt: TransactionReceipt;
}

export async function calculateKeylessDeployment(
    provider: Provider,
    bytecode: string,
    gasPrice: BigNumber,
    gasLimit: BigNumber,
    verbose: boolean
): Promise<KeylessDeployment> {
    const rawTransaction: UnsignedTransaction = {
        chainId: 0, // If the chain ID is 0 or null, then EIP-155 is disabled and legacy signing is used, unless overridden in a signature.
        nonce: 0,
        gasPrice: gasPrice,
        value: zero,
        data: bytecode,
        gasLimit: gasLimit
    };

    const rawDeplotmentTx = serialize(rawTransaction, signature);
    const parsedDeploymentTx: Transaction = parse(rawDeplotmentTx);

    const estimatedGasCost = await provider.estimateGas(parsedDeploymentTx);

    // now we must have a transaction hash
    assert(parsedDeploymentTx.hash);
    // and a sender
    assert(parsedDeploymentTx.from);

    const keylessAccount = parsedDeploymentTx.from;
    if (verbose) {
        console.info(`Keyless account is derived:\n${keylessAccount}\n`);
    }

    const contractAddress = ethers.utils.getContractAddress({
        from: keylessAccount,
        nonce: 0
    });

    const code = await provider.getCode(contractAddress);
    let alreadyDeployed = false;
    if (code != "0x") {
        alreadyDeployed = true;
    }

    return {
        contractAddress,
        keylessAccount,
        estimatedGasCost,
        alreadyDeployed,
        rawTx: rawDeplotmentTx
    };
}

export async function keylessDeploy(
    feeder: Signer,
    bytecode: string,
    gasPrice: BigNumber,
    gasLimit: BigNumber,
    verbose: boolean
): Promise<KeylessDeploymentResult> {
    assert(feeder.provider);
    const provider = feeder.provider;
    const result = await calculateKeylessDeployment(
        provider,
        bytecode,
        gasPrice,
        gasLimit,
        verbose
    );

    if (result.alreadyDeployed) {
        logAddress(
            verbose,
            "Keyless deployment is ALREADY done",
            result.contractAddress
        );
        return result as KeylessDeploymentResult;
    }

    const keylessAccount = result.keylessAccount;
    const contractAddress = result.contractAddress;
    const rawDeploymentTx = result.rawTx;

    // feed keyless account
    const ethAmtForDeployment = gasLimit.mul(gasPrice);
    const feedTx = await feeder.sendTransaction({
        to: keylessAccount,
        value: ethAmtForDeployment
    });
    logTx(verbose, "Tx: waiting, keyless account feed", feedTx.hash);
    let receipt = await feedTx.wait();
    logTx(verbose, "Tx: keyless account is feeded", feedTx.hash);

    const deploymentTx = await provider.sendTransaction(rawDeploymentTx);
    logTx(verbose, "Tx: waiting, keyless depleyment", deploymentTx.hash);
    receipt = await deploymentTx.wait();
    assert(receipt.contractAddress == contractAddress);
    logDeployment(
        verbose,
        "Deployed: keyless",
        deploymentTx.hash,
        receipt.contractAddress
    );
    let _result = result as KeylessDeploymentResult;
    _result.receipt = receipt;
    return _result;
}
