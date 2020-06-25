// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package coordinatorproxy

import (
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = abi.U256
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
)

// TypesAccountInclusionProof is an auto generated low-level Go binding around an user-defined struct.
type TypesAccountInclusionProof struct {
	PathToAccount *big.Int
	Account       TypesUserAccount
}

// TypesAccountMerkleProof is an auto generated low-level Go binding around an user-defined struct.
type TypesAccountMerkleProof struct {
	AccountIP TypesAccountInclusionProof
	Siblings  [][32]byte
}

// TypesPDAInclusionProof is an auto generated low-level Go binding around an user-defined struct.
type TypesPDAInclusionProof struct {
	PathToPubkey *big.Int
	PubkeyLeaf   TypesPDALeaf
}

// TypesPDALeaf is an auto generated low-level Go binding around an user-defined struct.
type TypesPDALeaf struct {
	Pubkey []byte
}

// TypesPDAMerkleProof is an auto generated low-level Go binding around an user-defined struct.
type TypesPDAMerkleProof struct {
	Pda      TypesPDAInclusionProof
	Siblings [][32]byte
}

// TypesTransaction is an auto generated low-level Go binding around an user-defined struct.
type TypesTransaction struct {
	FromIndex *big.Int
	ToIndex   *big.Int
	TokenType *big.Int
	Amount    uint32
	Signature []byte
}

// TypesUserAccount is an auto generated low-level Go binding around an user-defined struct.
type TypesUserAccount struct {
	ID        *big.Int
	TokenType *big.Int
	Balance   *big.Int
	Nonce     *big.Int
}

// CoordinatorproxyABI is the input ABI used to generate the binding from.
const CoordinatorproxyABI = "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_registryAddr\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"constant\":true,\"inputs\":[],\"name\":\"depositManager\",\"outputs\":[{\"internalType\":\"contractDepositManager\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"nameRegistry\",\"outputs\":[{\"internalType\":\"contractNameRegistry\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"rollup\",\"outputs\":[{\"internalType\":\"contractRollup\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_subTreeDepth\",\"type\":\"uint256\"},{\"components\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"pathToAccount\",\"type\":\"uint256\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ID\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"balance\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"internalType\":\"structTypes.UserAccount\",\"name\":\"account\",\"type\":\"tuple\"}],\"internalType\":\"structTypes.AccountInclusionProof\",\"name\":\"accountIP\",\"type\":\"tuple\"},{\"internalType\":\"bytes32[]\",\"name\":\"siblings\",\"type\":\"bytes32[]\"}],\"internalType\":\"structTypes.AccountMerkleProof\",\"name\":\"_zero_account_mp\",\"type\":\"tuple\"}],\"name\":\"finaliseDepositsAndSubmitBatch\",\"outputs\":[],\"payable\":true,\"stateMutability\":\"payable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"internalType\":\"bytes[]\",\"name\":\"_txs\",\"type\":\"bytes[]\"},{\"internalType\":\"bytes32\",\"name\":\"_updatedRoot\",\"type\":\"bytes32\"}],\"name\":\"submitBatch\",\"outputs\":[],\"payable\":true,\"stateMutability\":\"payable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_balanceRoot\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"_accountsRoot\",\"type\":\"bytes32\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"fromIndex\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"toIndex\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint32\",\"name\":\"amount\",\"type\":\"uint32\"},{\"internalType\":\"bytes\",\"name\":\"signature\",\"type\":\"bytes\"}],\"internalType\":\"structTypes.Transaction\",\"name\":\"_tx\",\"type\":\"tuple\"},{\"components\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"pathToPubkey\",\"type\":\"uint256\"},{\"components\":[{\"internalType\":\"bytes\",\"name\":\"pubkey\",\"type\":\"bytes\"}],\"internalType\":\"structTypes.PDALeaf\",\"name\":\"pubkey_leaf\",\"type\":\"tuple\"}],\"internalType\":\"structTypes.PDAInclusionProof\",\"name\":\"_pda\",\"type\":\"tuple\"},{\"internalType\":\"bytes32[]\",\"name\":\"siblings\",\"type\":\"bytes32[]\"}],\"internalType\":\"structTypes.PDAMerkleProof\",\"name\":\"_from_pda_proof\",\"type\":\"tuple\"},{\"components\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"pathToAccount\",\"type\":\"uint256\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ID\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"balance\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"internalType\":\"structTypes.UserAccount\",\"name\":\"account\",\"type\":\"tuple\"}],\"internalType\":\"structTypes.AccountInclusionProof\",\"name\":\"accountIP\",\"type\":\"tuple\"},{\"internalType\":\"bytes32[]\",\"name\":\"siblings\",\"type\":\"bytes32[]\"}],\"internalType\":\"structTypes.AccountMerkleProof\",\"name\":\"_from_merkle_proof\",\"type\":\"tuple\"},{\"components\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"pathToAccount\",\"type\":\"uint256\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ID\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"balance\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"internalType\":\"structTypes.UserAccount\",\"name\":\"account\",\"type\":\"tuple\"}],\"internalType\":\"structTypes.AccountInclusionProof\",\"name\":\"accountIP\",\"type\":\"tuple\"},{\"internalType\":\"bytes32[]\",\"name\":\"siblings\",\"type\":\"bytes32[]\"}],\"internalType\":\"structTypes.AccountMerkleProof\",\"name\":\"_to_merkle_proof\",\"type\":\"tuple\"}],\"name\":\"processTx\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"}]"

// Coordinatorproxy is an auto generated Go binding around an Ethereum contract.
type Coordinatorproxy struct {
	CoordinatorproxyCaller     // Read-only binding to the contract
	CoordinatorproxyTransactor // Write-only binding to the contract
	CoordinatorproxyFilterer   // Log filterer for contract events
}

// CoordinatorproxyCaller is an auto generated read-only Go binding around an Ethereum contract.
type CoordinatorproxyCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// CoordinatorproxyTransactor is an auto generated write-only Go binding around an Ethereum contract.
type CoordinatorproxyTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// CoordinatorproxyFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type CoordinatorproxyFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// CoordinatorproxySession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type CoordinatorproxySession struct {
	Contract     *Coordinatorproxy // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// CoordinatorproxyCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type CoordinatorproxyCallerSession struct {
	Contract *CoordinatorproxyCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts           // Call options to use throughout this session
}

// CoordinatorproxyTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type CoordinatorproxyTransactorSession struct {
	Contract     *CoordinatorproxyTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts           // Transaction auth options to use throughout this session
}

// CoordinatorproxyRaw is an auto generated low-level Go binding around an Ethereum contract.
type CoordinatorproxyRaw struct {
	Contract *Coordinatorproxy // Generic contract binding to access the raw methods on
}

// CoordinatorproxyCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type CoordinatorproxyCallerRaw struct {
	Contract *CoordinatorproxyCaller // Generic read-only contract binding to access the raw methods on
}

// CoordinatorproxyTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type CoordinatorproxyTransactorRaw struct {
	Contract *CoordinatorproxyTransactor // Generic write-only contract binding to access the raw methods on
}

// NewCoordinatorproxy creates a new instance of Coordinatorproxy, bound to a specific deployed contract.
func NewCoordinatorproxy(address common.Address, backend bind.ContractBackend) (*Coordinatorproxy, error) {
	contract, err := bindCoordinatorproxy(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Coordinatorproxy{CoordinatorproxyCaller: CoordinatorproxyCaller{contract: contract}, CoordinatorproxyTransactor: CoordinatorproxyTransactor{contract: contract}, CoordinatorproxyFilterer: CoordinatorproxyFilterer{contract: contract}}, nil
}

// NewCoordinatorproxyCaller creates a new read-only instance of Coordinatorproxy, bound to a specific deployed contract.
func NewCoordinatorproxyCaller(address common.Address, caller bind.ContractCaller) (*CoordinatorproxyCaller, error) {
	contract, err := bindCoordinatorproxy(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &CoordinatorproxyCaller{contract: contract}, nil
}

// NewCoordinatorproxyTransactor creates a new write-only instance of Coordinatorproxy, bound to a specific deployed contract.
func NewCoordinatorproxyTransactor(address common.Address, transactor bind.ContractTransactor) (*CoordinatorproxyTransactor, error) {
	contract, err := bindCoordinatorproxy(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &CoordinatorproxyTransactor{contract: contract}, nil
}

// NewCoordinatorproxyFilterer creates a new log filterer instance of Coordinatorproxy, bound to a specific deployed contract.
func NewCoordinatorproxyFilterer(address common.Address, filterer bind.ContractFilterer) (*CoordinatorproxyFilterer, error) {
	contract, err := bindCoordinatorproxy(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &CoordinatorproxyFilterer{contract: contract}, nil
}

// bindCoordinatorproxy binds a generic wrapper to an already deployed contract.
func bindCoordinatorproxy(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(CoordinatorproxyABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Coordinatorproxy *CoordinatorproxyRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _Coordinatorproxy.Contract.CoordinatorproxyCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Coordinatorproxy *CoordinatorproxyRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.CoordinatorproxyTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Coordinatorproxy *CoordinatorproxyRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.CoordinatorproxyTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Coordinatorproxy *CoordinatorproxyCallerRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _Coordinatorproxy.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Coordinatorproxy *CoordinatorproxyTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Coordinatorproxy *CoordinatorproxyTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.contract.Transact(opts, method, params...)
}

// DepositManager is a free data retrieval call binding the contract method 0x6c7ac9d8.
//
// Solidity: function depositManager() view returns(address)
func (_Coordinatorproxy *CoordinatorproxyCaller) DepositManager(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Coordinatorproxy.contract.Call(opts, out, "depositManager")
	return *ret0, err
}

// DepositManager is a free data retrieval call binding the contract method 0x6c7ac9d8.
//
// Solidity: function depositManager() view returns(address)
func (_Coordinatorproxy *CoordinatorproxySession) DepositManager() (common.Address, error) {
	return _Coordinatorproxy.Contract.DepositManager(&_Coordinatorproxy.CallOpts)
}

// DepositManager is a free data retrieval call binding the contract method 0x6c7ac9d8.
//
// Solidity: function depositManager() view returns(address)
func (_Coordinatorproxy *CoordinatorproxyCallerSession) DepositManager() (common.Address, error) {
	return _Coordinatorproxy.Contract.DepositManager(&_Coordinatorproxy.CallOpts)
}

// NameRegistry is a free data retrieval call binding the contract method 0x4eb7221a.
//
// Solidity: function nameRegistry() view returns(address)
func (_Coordinatorproxy *CoordinatorproxyCaller) NameRegistry(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Coordinatorproxy.contract.Call(opts, out, "nameRegistry")
	return *ret0, err
}

// NameRegistry is a free data retrieval call binding the contract method 0x4eb7221a.
//
// Solidity: function nameRegistry() view returns(address)
func (_Coordinatorproxy *CoordinatorproxySession) NameRegistry() (common.Address, error) {
	return _Coordinatorproxy.Contract.NameRegistry(&_Coordinatorproxy.CallOpts)
}

// NameRegistry is a free data retrieval call binding the contract method 0x4eb7221a.
//
// Solidity: function nameRegistry() view returns(address)
func (_Coordinatorproxy *CoordinatorproxyCallerSession) NameRegistry() (common.Address, error) {
	return _Coordinatorproxy.Contract.NameRegistry(&_Coordinatorproxy.CallOpts)
}

// ProcessTx is a free data retrieval call binding the contract method 0x72d061f8.
//
// Solidity: function processTx(bytes32 _balanceRoot, bytes32 _accountsRoot, TypesTransaction _tx, TypesPDAMerkleProof _from_pda_proof, TypesAccountMerkleProof _from_merkle_proof, TypesAccountMerkleProof _to_merkle_proof) view returns(bytes32, uint256, uint256, bool)
func (_Coordinatorproxy *CoordinatorproxyCaller) ProcessTx(opts *bind.CallOpts, _balanceRoot [32]byte, _accountsRoot [32]byte, _tx TypesTransaction, _from_pda_proof TypesPDAMerkleProof, _from_merkle_proof TypesAccountMerkleProof, _to_merkle_proof TypesAccountMerkleProof) ([32]byte, *big.Int, *big.Int, bool, error) {
	var (
		ret0 = new([32]byte)
		ret1 = new(*big.Int)
		ret2 = new(*big.Int)
		ret3 = new(bool)
	)
	out := &[]interface{}{
		ret0,
		ret1,
		ret2,
		ret3,
	}
	err := _Coordinatorproxy.contract.Call(opts, out, "processTx", _balanceRoot, _accountsRoot, _tx, _from_pda_proof, _from_merkle_proof, _to_merkle_proof)
	return *ret0, *ret1, *ret2, *ret3, err
}

// ProcessTx is a free data retrieval call binding the contract method 0x72d061f8.
//
// Solidity: function processTx(bytes32 _balanceRoot, bytes32 _accountsRoot, TypesTransaction _tx, TypesPDAMerkleProof _from_pda_proof, TypesAccountMerkleProof _from_merkle_proof, TypesAccountMerkleProof _to_merkle_proof) view returns(bytes32, uint256, uint256, bool)
func (_Coordinatorproxy *CoordinatorproxySession) ProcessTx(_balanceRoot [32]byte, _accountsRoot [32]byte, _tx TypesTransaction, _from_pda_proof TypesPDAMerkleProof, _from_merkle_proof TypesAccountMerkleProof, _to_merkle_proof TypesAccountMerkleProof) ([32]byte, *big.Int, *big.Int, bool, error) {
	return _Coordinatorproxy.Contract.ProcessTx(&_Coordinatorproxy.CallOpts, _balanceRoot, _accountsRoot, _tx, _from_pda_proof, _from_merkle_proof, _to_merkle_proof)
}

// ProcessTx is a free data retrieval call binding the contract method 0x72d061f8.
//
// Solidity: function processTx(bytes32 _balanceRoot, bytes32 _accountsRoot, TypesTransaction _tx, TypesPDAMerkleProof _from_pda_proof, TypesAccountMerkleProof _from_merkle_proof, TypesAccountMerkleProof _to_merkle_proof) view returns(bytes32, uint256, uint256, bool)
func (_Coordinatorproxy *CoordinatorproxyCallerSession) ProcessTx(_balanceRoot [32]byte, _accountsRoot [32]byte, _tx TypesTransaction, _from_pda_proof TypesPDAMerkleProof, _from_merkle_proof TypesAccountMerkleProof, _to_merkle_proof TypesAccountMerkleProof) ([32]byte, *big.Int, *big.Int, bool, error) {
	return _Coordinatorproxy.Contract.ProcessTx(&_Coordinatorproxy.CallOpts, _balanceRoot, _accountsRoot, _tx, _from_pda_proof, _from_merkle_proof, _to_merkle_proof)
}

// Rollup is a free data retrieval call binding the contract method 0xcb23bcb5.
//
// Solidity: function rollup() view returns(address)
func (_Coordinatorproxy *CoordinatorproxyCaller) Rollup(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Coordinatorproxy.contract.Call(opts, out, "rollup")
	return *ret0, err
}

// Rollup is a free data retrieval call binding the contract method 0xcb23bcb5.
//
// Solidity: function rollup() view returns(address)
func (_Coordinatorproxy *CoordinatorproxySession) Rollup() (common.Address, error) {
	return _Coordinatorproxy.Contract.Rollup(&_Coordinatorproxy.CallOpts)
}

// Rollup is a free data retrieval call binding the contract method 0xcb23bcb5.
//
// Solidity: function rollup() view returns(address)
func (_Coordinatorproxy *CoordinatorproxyCallerSession) Rollup() (common.Address, error) {
	return _Coordinatorproxy.Contract.Rollup(&_Coordinatorproxy.CallOpts)
}

// FinaliseDepositsAndSubmitBatch is a paid mutator transaction binding the contract method 0x563a4555.
//
// Solidity: function finaliseDepositsAndSubmitBatch(uint256 _subTreeDepth, TypesAccountMerkleProof _zero_account_mp) payable returns()
func (_Coordinatorproxy *CoordinatorproxyTransactor) FinaliseDepositsAndSubmitBatch(opts *bind.TransactOpts, _subTreeDepth *big.Int, _zero_account_mp TypesAccountMerkleProof) (*types.Transaction, error) {
	return _Coordinatorproxy.contract.Transact(opts, "finaliseDepositsAndSubmitBatch", _subTreeDepth, _zero_account_mp)
}

// FinaliseDepositsAndSubmitBatch is a paid mutator transaction binding the contract method 0x563a4555.
//
// Solidity: function finaliseDepositsAndSubmitBatch(uint256 _subTreeDepth, TypesAccountMerkleProof _zero_account_mp) payable returns()
func (_Coordinatorproxy *CoordinatorproxySession) FinaliseDepositsAndSubmitBatch(_subTreeDepth *big.Int, _zero_account_mp TypesAccountMerkleProof) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.FinaliseDepositsAndSubmitBatch(&_Coordinatorproxy.TransactOpts, _subTreeDepth, _zero_account_mp)
}

// FinaliseDepositsAndSubmitBatch is a paid mutator transaction binding the contract method 0x563a4555.
//
// Solidity: function finaliseDepositsAndSubmitBatch(uint256 _subTreeDepth, TypesAccountMerkleProof _zero_account_mp) payable returns()
func (_Coordinatorproxy *CoordinatorproxyTransactorSession) FinaliseDepositsAndSubmitBatch(_subTreeDepth *big.Int, _zero_account_mp TypesAccountMerkleProof) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.FinaliseDepositsAndSubmitBatch(&_Coordinatorproxy.TransactOpts, _subTreeDepth, _zero_account_mp)
}

// SubmitBatch is a paid mutator transaction binding the contract method 0x0e981757.
//
// Solidity: function submitBatch(bytes[] _txs, bytes32 _updatedRoot) payable returns()
func (_Coordinatorproxy *CoordinatorproxyTransactor) SubmitBatch(opts *bind.TransactOpts, _txs [][]byte, _updatedRoot [32]byte) (*types.Transaction, error) {
	return _Coordinatorproxy.contract.Transact(opts, "submitBatch", _txs, _updatedRoot)
}

// SubmitBatch is a paid mutator transaction binding the contract method 0x0e981757.
//
// Solidity: function submitBatch(bytes[] _txs, bytes32 _updatedRoot) payable returns()
func (_Coordinatorproxy *CoordinatorproxySession) SubmitBatch(_txs [][]byte, _updatedRoot [32]byte) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.SubmitBatch(&_Coordinatorproxy.TransactOpts, _txs, _updatedRoot)
}

// SubmitBatch is a paid mutator transaction binding the contract method 0x0e981757.
//
// Solidity: function submitBatch(bytes[] _txs, bytes32 _updatedRoot) payable returns()
func (_Coordinatorproxy *CoordinatorproxyTransactorSession) SubmitBatch(_txs [][]byte, _updatedRoot [32]byte) (*types.Transaction, error) {
	return _Coordinatorproxy.Contract.SubmitBatch(&_Coordinatorproxy.TransactOpts, _txs, _updatedRoot)
}
