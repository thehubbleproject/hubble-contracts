// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package trial

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

// TrialTransaction is an auto generated low-level Go binding around an user-defined struct.
type TrialTransaction struct {
	From      TrialUserAccount
	To        TrialUserAccount
	TokenType *big.Int
	Amount    uint32
	Signature []byte
}

// TrialUserAccount is an auto generated low-level Go binding around an user-defined struct.
type TrialUserAccount struct {
	ID        *big.Int
	TokenType *big.Int
	Balance   *big.Int
	Nonce     *big.Int
}

// TrialABI is the input ABI used to generate the binding from.
const TrialABI = "[{\"constant\":true,\"inputs\":[],\"name\":\"ABIDecodeTransaction\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"components\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ID\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"balance\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"internalType\":\"structTrial.UserAccount\",\"name\":\"from\",\"type\":\"tuple\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ID\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"balance\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"internalType\":\"structTrial.UserAccount\",\"name\":\"to\",\"type\":\"tuple\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint32\",\"name\":\"amount\",\"type\":\"uint32\"},{\"internalType\":\"bytes\",\"name\":\"signature\",\"type\":\"bytes\"}],\"internalType\":\"structTrial.Transaction\",\"name\":\"_txs\",\"type\":\"tuple\"}],\"name\":\"ABIEncodeTransaction\",\"outputs\":[{\"internalType\":\"bytes\",\"name\":\"\",\"type\":\"bytes\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"data\",\"outputs\":[{\"internalType\":\"bytes\",\"name\":\"\",\"type\":\"bytes\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"}]"

// Trial is an auto generated Go binding around an Ethereum contract.
type Trial struct {
	TrialCaller     // Read-only binding to the contract
	TrialTransactor // Write-only binding to the contract
	TrialFilterer   // Log filterer for contract events
}

// TrialCaller is an auto generated read-only Go binding around an Ethereum contract.
type TrialCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// TrialTransactor is an auto generated write-only Go binding around an Ethereum contract.
type TrialTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// TrialFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type TrialFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// TrialSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type TrialSession struct {
	Contract     *Trial            // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// TrialCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type TrialCallerSession struct {
	Contract *TrialCaller  // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts // Call options to use throughout this session
}

// TrialTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type TrialTransactorSession struct {
	Contract     *TrialTransactor  // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// TrialRaw is an auto generated low-level Go binding around an Ethereum contract.
type TrialRaw struct {
	Contract *Trial // Generic contract binding to access the raw methods on
}

// TrialCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type TrialCallerRaw struct {
	Contract *TrialCaller // Generic read-only contract binding to access the raw methods on
}

// TrialTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type TrialTransactorRaw struct {
	Contract *TrialTransactor // Generic write-only contract binding to access the raw methods on
}

// NewTrial creates a new instance of Trial, bound to a specific deployed contract.
func NewTrial(address common.Address, backend bind.ContractBackend) (*Trial, error) {
	contract, err := bindTrial(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Trial{TrialCaller: TrialCaller{contract: contract}, TrialTransactor: TrialTransactor{contract: contract}, TrialFilterer: TrialFilterer{contract: contract}}, nil
}

// NewTrialCaller creates a new read-only instance of Trial, bound to a specific deployed contract.
func NewTrialCaller(address common.Address, caller bind.ContractCaller) (*TrialCaller, error) {
	contract, err := bindTrial(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &TrialCaller{contract: contract}, nil
}

// NewTrialTransactor creates a new write-only instance of Trial, bound to a specific deployed contract.
func NewTrialTransactor(address common.Address, transactor bind.ContractTransactor) (*TrialTransactor, error) {
	contract, err := bindTrial(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &TrialTransactor{contract: contract}, nil
}

// NewTrialFilterer creates a new log filterer instance of Trial, bound to a specific deployed contract.
func NewTrialFilterer(address common.Address, filterer bind.ContractFilterer) (*TrialFilterer, error) {
	contract, err := bindTrial(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &TrialFilterer{contract: contract}, nil
}

// bindTrial binds a generic wrapper to an already deployed contract.
func bindTrial(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(TrialABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Trial *TrialRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _Trial.Contract.TrialCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Trial *TrialRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Trial.Contract.TrialTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Trial *TrialRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Trial.Contract.TrialTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Trial *TrialCallerRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _Trial.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Trial *TrialTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Trial.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Trial *TrialTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Trial.Contract.contract.Transact(opts, method, params...)
}

// ABIDecodeTransaction is a free data retrieval call binding the contract method 0x33384958.
//
// Solidity: function ABIDecodeTransaction() view returns(uint256)
func (_Trial *TrialCaller) ABIDecodeTransaction(opts *bind.CallOpts) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _Trial.contract.Call(opts, out, "ABIDecodeTransaction")
	return *ret0, err
}

// ABIDecodeTransaction is a free data retrieval call binding the contract method 0x33384958.
//
// Solidity: function ABIDecodeTransaction() view returns(uint256)
func (_Trial *TrialSession) ABIDecodeTransaction() (*big.Int, error) {
	return _Trial.Contract.ABIDecodeTransaction(&_Trial.CallOpts)
}

// ABIDecodeTransaction is a free data retrieval call binding the contract method 0x33384958.
//
// Solidity: function ABIDecodeTransaction() view returns(uint256)
func (_Trial *TrialCallerSession) ABIDecodeTransaction() (*big.Int, error) {
	return _Trial.Contract.ABIDecodeTransaction(&_Trial.CallOpts)
}

// Data is a free data retrieval call binding the contract method 0x73d4a13a.
//
// Solidity: function data() view returns(bytes)
func (_Trial *TrialCaller) Data(opts *bind.CallOpts) ([]byte, error) {
	var (
		ret0 = new([]byte)
	)
	out := ret0
	err := _Trial.contract.Call(opts, out, "data")
	return *ret0, err
}

// Data is a free data retrieval call binding the contract method 0x73d4a13a.
//
// Solidity: function data() view returns(bytes)
func (_Trial *TrialSession) Data() ([]byte, error) {
	return _Trial.Contract.Data(&_Trial.CallOpts)
}

// Data is a free data retrieval call binding the contract method 0x73d4a13a.
//
// Solidity: function data() view returns(bytes)
func (_Trial *TrialCallerSession) Data() ([]byte, error) {
	return _Trial.Contract.Data(&_Trial.CallOpts)
}

// ABIEncodeTransaction is a paid mutator transaction binding the contract method 0xfe36ac3c.
//
// Solidity: function ABIEncodeTransaction(TrialTransaction _txs) returns(bytes)
func (_Trial *TrialTransactor) ABIEncodeTransaction(opts *bind.TransactOpts, _txs TrialTransaction) (*types.Transaction, error) {
	return _Trial.contract.Transact(opts, "ABIEncodeTransaction", _txs)
}

// ABIEncodeTransaction is a paid mutator transaction binding the contract method 0xfe36ac3c.
//
// Solidity: function ABIEncodeTransaction(TrialTransaction _txs) returns(bytes)
func (_Trial *TrialSession) ABIEncodeTransaction(_txs TrialTransaction) (*types.Transaction, error) {
	return _Trial.Contract.ABIEncodeTransaction(&_Trial.TransactOpts, _txs)
}

// ABIEncodeTransaction is a paid mutator transaction binding the contract method 0xfe36ac3c.
//
// Solidity: function ABIEncodeTransaction(TrialTransaction _txs) returns(bytes)
func (_Trial *TrialTransactorSession) ABIEncodeTransaction(_txs TrialTransaction) (*types.Transaction, error) {
	return _Trial.Contract.ABIEncodeTransaction(&_Trial.TransactOpts, _txs)
}
