import { ParamType } from "ethers/lib/utils";
import { Hubble } from "../ts/hubble";

const argv = require("minimist")(process.argv.slice(2), {
    string: ["url"]
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    const providerUrl = argv.url || "http://localhost:8545";

    const hubble = Hubble.fromDefault(providerUrl);
    const {
        DepositsFinalised,
        StakeWithdraw
    } = hubble.contracts.rollup.filters;

    Object.entries(hubble.contracts.rollup.interface.events).map(
        ([eventName, eventFragment]) =>
            hubble.contracts.rollup.on(eventName, args => {
                console.log(
                    eventFragment.name,
                    eventFragment.inputs.map(
                        (input: ParamType, i) => `${input.name} ${args[i]}`
                    )
                );
            })
    );
    while (true) {
        await delay(1000);
        hubble.contracts.rollup.emit(DepositsFinalised(null, null), [
            "0xabcd",
            123
        ]);
        hubble.contracts.rollup.emit(StakeWithdraw(null, null), [
            "0xdeadbeef",
            5566
        ]);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
