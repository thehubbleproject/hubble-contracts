# Setup for Local Development

## Deps

- [Geth](https://geth.ethereum.org/docs/install-and-build/installing-geth)
- [NodeJS](https://nodejs.org/en/download/)
- (Recommended instead of NodeJS) [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

## Geth

### run

```sh
geth --datadir dev-chain/ --http --dev --dev.period=14 --rpc.allow-unprotected-txs
```

### fund deployer

Use `Account #0`

```txt
Account #0: 0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

In shell:
```sh
geth attach ./dev-chain/geth.ipc
```

Then in geth console:
```sh
eth.coinbase
account = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
eth.sendTransaction({ from:eth.coinbase, to:account, value: web3.toWei(10000, "ether") })
```

## Deploy Contracts

### install

```sh
npm install
```

### (recommended) configure BurnAuction.sol

Before we deploy contracts we recommend you shorten the slot time of the [burn auction contract](./contracts/proposers/BurnAuction.sol) to make iteration faster.

```diff
diff --git a/contracts/proposers/BurnAuction.sol b/contracts/proposers/BurnAuction.sol
index 479b34d..963b30a 100644
--- a/contracts/proposers/BurnAuction.sol
+++ b/contracts/proposers/BurnAuction.sol
@@ -7,8 +7,8 @@ import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
 contract BurnAuction is Chooser {
     using SafeMath for uint256;
 
-    uint32 public constant BLOCKS_PER_SLOT = 100;
-    uint32 public constant DELTA_BLOCKS_INITIAL_SLOT = 1000;
+    uint32 public constant BLOCKS_PER_SLOT = 10;
+    uint32 public constant DELTA_BLOCKS_INITIAL_SLOT = 20;
 
     // donation numerator and demoninator are used to calculate donation amount
     uint256 public constant DONATION_DENOMINATOR = 10000;


```

### generate

Compiles [Solidity](https://soliditylang.org/) contracts and [TypeChain](https://github.com/ethereum-ts/Typechain) [TypeScript](https://www.typescriptlang.org/) bindings.
```sh
npm run generate
```

### deploy

```
npm run deploy -- \
--key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
--root 0xbfef011dd64abe7707cee7b3b74a00b86689c8451f548371073ce3c935e09984 \
--numPubkeys 32
```

This should generate a `genesis.json` file that looks like:

```json
{
    "parameters": {
        "MAX_DEPTH": 32,
        "MAX_DEPOSIT_SUBTREE_DEPTH": 2,
        "STAKE_AMOUNT": "100000000000000000",
        "BLOCKS_TO_FINALISE": 40320,
        "MIN_GAS_LEFT": 10000,
        "MAX_TXS_PER_COMMIT": 32,
        "USE_BURN_AUCTION": true,
        "DONATION_ADDRESS": "0x00000000000000000000000000000000000000d0",
        "DONATION_NUMERATOR": 7500,
        "GENESIS_STATE_ROOT": "0xbfef011dd64abe7707cee7b3b74a00b86689c8451f548371073ce3c935e09984"
    },
    "addresses": {
        "frontendGeneric": "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
        "frontendTransfer": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        "frontendMassMigration": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
        "frontendCreate2Transfer": "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
        "blsAccountRegistry": "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
        "tokenRegistry": "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
        "transfer": "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
        "massMigration": "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
        "create2Transfer": "0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82",
        "burnAuction": "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
        "exampleToken": "0x9A676e781A523b5d0C0e43731313A708CB607508",
        "spokeRegistry": "0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE",
        "vault": "0x68B1D87F95878fE05B998F19b66F4baba5De1aed",
        "depositManager": "0x3Aa5ebB10DC797CAC828524e59A333d0A371443c",
        "rollup": "0xc6e7DF5E7b4f2A278906862b61205850344D4e7d",
        "withdrawManager": "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44"
    },
    "auxiliary": {
        "domain": "0x4ea7799478a7af2a47ba555f04aec4ae4ba240bf410d7c859c34c310f0413892",
        "genesisEth1Block": 306,
        "version": "20539ad4d99b3d3e4810de24c14ba41cdd89ea2c"
    }
}
```

The client will be parameterized using this file.

## Run Client (Node)

```sh
npm run dev
```

### repl (Hubble console)

```sh
npm run repl
```

Then in repl console, run a transfer:

```sh
hubble.transfer(0, 1, 1, 1)
```

## Run Tests

```sh
npm run test
```

Note: Running the full test suite will have ~5 failures. This is expected until https://github.com/thehubbleproject/hubble-contracts/issues/603 is resolved.

### fast/slow/client

```sh
npm run test -- test/fast/* # slow/client/etc.
```
