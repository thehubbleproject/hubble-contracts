import { PRODUCTION_PARAMS } from "../ts/constants";

import fs from "fs";

fs.writeFileSync("parameters.json", JSON.stringify(PRODUCTION_PARAMS, null, 4));
