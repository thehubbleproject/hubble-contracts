export function logDeployment(
    verbose: boolean,
    desc: string,
    tx: string,
    address: string
) {
    if (verbose) {
        console.log(desc);
        console.log("tx_hash: ", tx);
        console.log("address: ", address);
        console.log();
    }
}

export function logTx(verbose: boolean, desc: string, tx: string) {
    if (verbose) {
        console.log(desc);
        console.log("tx_hash: ", tx);
        console.log();
    }
}

export function logAddress(verbose: boolean, desc: string, tx: string) {
    if (verbose) {
        console.log(desc);
        console.log("address: ", tx);
        console.log();
    }
}
