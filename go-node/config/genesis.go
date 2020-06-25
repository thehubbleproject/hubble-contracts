package config

import (
	"encoding/json"
	"io/ioutil"
	"os"

	"errors"
	"math"

	"github.com/BOPR/common"
)

type Genesis struct {
	StartEthBlock           uint64          `json:"startEthBlock"`
	MaxTreeDepth            uint64          `json:"maxTreeDepth"`
	MaxDepositSubTreeHeight uint64          `json:"maxDepositSubTreeHeight"`
	StakeAmount             uint64          `json:"stakeAmount"`
	GenesisAccounts         GenesisAccounts `json:"genesisAccounts"`
}

// Validate validates the genesis file and checks for basic things
func (g Genesis) Validate() error {
	if int(math.Exp2(float64(g.MaxTreeDepth)))-len(g.GenesisAccounts.Accounts) < 0 {
		return errors.New("More accounts submitted than can be accomodated")
	}

	if len(g.GenesisAccounts.Accounts) < 1 {
		return errors.New("Genesis file must contain atleast coordinator leaf")
	}

	if !g.GenesisAccounts.Accounts[0].IsCoordinator() {
		return errors.New("First account in the genesis file should be the coordinator")
	}

	return nil
}

// GenUserAccount exists to allow remove circular dependency with types
// and to allow storing more data about the account than the data in UserAccount
type GenUserAccount struct {
	ID        uint64 `json:"ID"`
	Balance   uint64
	TokenType uint64
	Nonce     uint64
	Status    uint64
	PublicKey string
}

func (acc *GenUserAccount) IsCoordinator() bool {
	if acc.ID != 0 || acc.Balance != 0 || acc.TokenType != 0 || acc.Nonce != 0 || acc.Status != 1 {
		return false
	}
	return true
}

func NewGenUserAccount(id, balance, tokenType, nonce, status uint64, publicKey string) GenUserAccount {
	return GenUserAccount{
		ID:        id,
		Balance:   balance,
		TokenType: tokenType,
		Nonce:     nonce,
		Status:    status,
		PublicKey: publicKey,
	}
}

type GenesisAccounts struct {
	Accounts []GenUserAccount `json:"gen_accounts"`
}

func NewGenesisAccounts(accounts []GenUserAccount) GenesisAccounts {
	return GenesisAccounts{Accounts: accounts}
}

func EmptyGenesisAccount() GenUserAccount {
	return NewGenUserAccount(0, 0, 0, 0, 100, "")
}

func DefaultGenesisAccounts() GenesisAccounts {
	var accounts []GenUserAccount

	// add coordinator account
	acc := NewGenUserAccount(common.COORDINATOR, common.COORDINATOR, common.COORDINATOR, common.COORDINATOR, 1, "0")
	accounts = append(accounts, acc)

	return NewGenesisAccounts(accounts)
}

func DefaultGenesis() Genesis {
	return Genesis{
		StartEthBlock:           0,
		MaxTreeDepth:            common.DEFAULT_DEPTH,
		MaxDepositSubTreeHeight: common.DEFAULT_DEPTH,
		StakeAmount:             32,
		GenesisAccounts:         DefaultGenesisAccounts(),
	}
}

func ReadGenesisFile() (Genesis, error) {
	var genesis Genesis

	genesisFile, err := os.Open("genesis.json")
	if err != nil {
		return genesis, err
	}
	defer genesisFile.Close()

	genBytes, err := ioutil.ReadAll(genesisFile)
	if err != nil {
		return genesis, err
	}

	err = json.Unmarshal(genBytes, &genesis)
	return genesis, err
}

func WriteGenesisFile(genesis Genesis) error {
	bz, err := json.MarshalIndent(genesis, "", "    ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile("genesis.json", bz, 0644)
}
