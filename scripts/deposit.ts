import minimist from "minimist";
import { Hubble } from "../ts/hubble";

const argv = minimist(process.argv.slice(2), {
    string: ["url", "tokenID", "pubkeys", "amount"]
});

/**
npm run deposit -- \
--tokenID 0 \
--amount 5 \
--pubkeys 06642b1af0ec2f7369126b3e45aaf11a050a26e2111150b319c4ca2f4a8d48c62442e01b651ce469632972f06c4d5d092da2cde3d42c0ead5ebeed8646d72b3f1f09c41c70cbdd8779920b4a3b15e6c7c518c5fdb93fdaed7a49c59b1f4d1e210aafa7a17239c9df9053ca4e71f10fb9f7b0f219e12e300676a756463253c287,2a7575b1bddf2c2b25f976788baae059ea410f589f0c244e1554d6f6f5398b6a1b997670d19c26c33ad1c61e21bd2742565518e0deafb105e7718de983bf757a0770cb4889aabb6f4897534f4770fce4b76f39b2cc8ed63b22e55ebf7e87a96001bbabd11ca55585bc0c016ad058a69c682cbe102a4b91f6084c71c857509dac
 */
async function main() {
    const providerUrl = argv.url || "http://localhost:8545";

    const hubble = await Hubble.fromDefault(providerUrl);

    let accIDs: number[] = [];

    if (argv.pubkeys) {
        const pubkeys = argv.pubkeys.split(",");
        accIDs = await hubble.registerPublicKeys(pubkeys);
    }
    const tokenID = parseInt(argv.tokenID);
    const amount = parseInt(argv.amount);
    await hubble.depositFor(accIDs, tokenID, amount);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
