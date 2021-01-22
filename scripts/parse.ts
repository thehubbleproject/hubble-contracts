import fs from "fs"

const jstr = fs.readFileSync("./artifacts/build-info/56bac1479b6af5b145f3e08fdc5c8a48.json").toString()

const j = JSON.parse(jstr)
const meta = j.output.contracts["contracts/test/SimpleStorage.sol"].SimpleStorage.metadata
console.log(JSON.stringify(JSON.parse(meta), null, 2))