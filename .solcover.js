const shell = require("shelljs"); // From solidity-coverage

module.exports = {
    skipFiles: ["./test", "./deployment"],
    onCompileComplete: async _config => {
        shell.exec(
            "typechain --target ethers-v5 './artifacts/contracts/**/!(*.dbg).json'"
        );
    }
};
