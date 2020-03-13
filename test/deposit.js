import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
const Rollup = artifacts.require("Rollup");

chai.use(chaiAsPromised).should()


contract('Rollup', async function (accounts) {  
    let wallets
    before(async function () {
      wallets = generateFirstWallets(mnemonics, Object.keys(stakes).length)
    })
  
    beforeEach(async function () {
    })
  })