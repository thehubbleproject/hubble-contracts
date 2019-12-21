const ethUtils = require("ethereumjs-util");
var BigNumber = require("big-number");

const Decoder = artifacts.require("decoder");

contract("decoder", async accounts => {
  it("it should emit event", async () => {
    let decoder = await Decoder.deployed();
    var result = await decoder.decodeTx(
      ethUtils.bufferToHex(
        "0x00000001000000020000000300000004000048656c6c6f2066726f6d2041444d466163746f72792e636f6d000000000000000000000000000000000000000000000000000000000000000000000000000000"
      )
    );
    const logs = result.logs;
    console.log("logs", logs[0].args.from);
  });
});
