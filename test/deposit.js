
var chai = require('chai');  
const chaiAsPromised = require('chai-as-promised')
const walletHelper = require('./helpers/wallet.js')

const Rollup = artifacts.require("Rollup");
const TokenRegistry = artifacts.require("TokenRegistry");
chai.use(chaiAsPromised).should()

contract('Rollup', async function (accounts) {  
    let wallets;
    before(async function () {
      wallets = walletHelper.generateFirstWallets(walletHelper.mnemonics, 10)
    })
    it('set Rollup in token registry', async function () {
      let tokenRegistry = await TokenRegistry.deployed();
      let rollupInstance = await Rollup.deployed();
      let setRollup = await tokenRegistry.setRollupAddress(rollupInstance.address, { from: wallets[0] });
      assert(setRollup, 'setRollupNC failed')
    })
//     it("should register token", async () => {
//       let testToken = await TestToken.deployed();
//       let rollupInstance = await Rollup.deployed();
//       let registerToken = await rollupInstance.requestTokenRegistration(testToken.address, { from: wallets[0]  })
//       assert(registerToken, "token registration failed");
//   });

//   // ----------------------------------------------------------------------------------

//   it("should approve token", async () => {
//       let testToken = await TestToken.deployed();
//       let rollupInstance = await Rollup.deployed();
//       let approveToken = await rollupInstance.approveToken(testToken.address,{ from: wallets[0]  })
//       assert(approveToken, "token registration failed");
// });

//   // ----------------------------------------------------------------------------------
//   it("should approve RollupNC on TestToken", async () => {
//     let rollupInstance = await Rollup.deployed();
//     let testToken = await TestToken.deployed();
//       let approveToken = await testToken.approve(
//         rollupInstance.address, 1700,
//           {from: wallets[0]}
//       )
//       assert(approveToken, "approveToken failed")
//   });


  })