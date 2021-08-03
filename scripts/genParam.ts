import { PRODUCTION_PARAMS } from "../ts/constants";
import { writeJSON } from "../ts/file";

async function main() {
    await writeJSON("parameters.json", PRODUCTION_PARAMS);
}

main()
    .then(() => {
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
