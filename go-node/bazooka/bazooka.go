package bazooka

import (
	"strings"

	"github.com/ethereum/go-ethereum/rpc"

	"github.com/BOPR/common"
	"github.com/BOPR/config"

	"github.com/BOPR/contracts/logger"
	"github.com/BOPR/contracts/merkleTree"
	"github.com/BOPR/contracts/rollup"

	"github.com/BOPR/contracts/depositmanager"

	"github.com/ethereum/go-ethereum/accounts/abi"
	ethCmn "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/tendermint/tendermint/libs/log"
)

// IContractCaller is the common interface using which we will interact with the contracts
// and the ethereum chain
type IBazooka interface {
	FetchBatchInputData(txHash ethCmn.Hash) (txs [][]byte, err error)
}

// TODO use context to remove this completely
// Global Contract Caller Object
var LoadedBazooka Bazooka

// ContractCaller satisfies the IContractCaller interface and contains all the variables required to interact
// With the ethereum chain along with contract addresses and ABI's
type Bazooka struct {
	log log.Logger

	EthClient *ethclient.Client

	ContractABI map[string]abi.ABI

	// Rollup contract
	RollupContract *rollup.Rollup
	BalanceTree    *merkleTree.MerkleTree
	EventLogger    *logger.Logger
	DepositManager *depositmanager.Depositmanager
}

// NewContractCaller contract caller
// NOTE: Reads configration from the config.toml file
func NewPreLoadedBazooka() (bazooka Bazooka, err error) {
	// TODO remove
	err = config.SetOperatorKeys(config.GlobalCfg.OperatorKey)
	if err != nil {
		return
	}
	err = config.ParseAndInitGlobalConfig()
	if err != nil {
		return
	}

	if RPCClient, err := rpc.Dial(config.GlobalCfg.EthRPC); err != nil {
		return bazooka, err
	} else {
		bazooka.EthClient = ethclient.NewClient(RPCClient)
	}

	bazooka.ContractABI = make(map[string]abi.ABI)

	// initialise all variables for rollup contract
	rollupContractAddress := ethCmn.HexToAddress(config.GlobalCfg.RollupAddress)
	if bazooka.RollupContract, err = rollup.NewRollup(rollupContractAddress, bazooka.EthClient); err != nil {
		return bazooka, err
	}
	if bazooka.ContractABI[common.ROLLUP_CONTRACT_KEY], err = abi.JSON(strings.NewReader(rollup.RollupABI)); err != nil {
		return bazooka, err
	}

	// initialise all variables for merkle tree contract
	balanceTreeContractAddress := ethCmn.HexToAddress(config.GlobalCfg.BalanceTreeAddress)
	if bazooka.BalanceTree, err = merkleTree.NewMerkleTree(balanceTreeContractAddress, bazooka.EthClient); err != nil {
		return bazooka, err
	}
	if bazooka.ContractABI[common.BALANCE_TREE_KEY], err = abi.JSON(strings.NewReader(merkleTree.MerkleTreeABI)); err != nil {
		return bazooka, err
	}

	// initialise all variables for event logger contract
	loggerAddress := ethCmn.HexToAddress(config.GlobalCfg.LoggerAddress)
	if bazooka.EventLogger, err = logger.NewLogger(loggerAddress, bazooka.EthClient); err != nil {
		return bazooka, err
	}
	if bazooka.ContractABI[common.LOGGER_KEY], err = abi.JSON(strings.NewReader(logger.LoggerABI)); err != nil {
		return bazooka, err
	}

	depositAddress := ethCmn.HexToAddress(config.GlobalCfg.DepositManagerAddress)
	if bazooka.DepositManager, err = depositmanager.NewDepositmanager(depositAddress, bazooka.EthClient); err != nil {
		return bazooka, err
	}
	if bazooka.ContractABI[common.DEPOSIT_MANAGER], err = abi.JSON(strings.NewReader(depositmanager.DepositmanagerABI)); err != nil {
		return bazooka, err
	}

	bazooka.log = common.Logger.With("module", "bazooka")

	return bazooka, nil
}
