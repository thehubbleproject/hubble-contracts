// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package depositmanager

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

// TypesUserAccount is an auto generated low-level Go binding around an user-defined struct.
type TypesUserAccount struct {
	ID        *big.Int
	TokenType *big.Int
	Balance   *big.Int
	Nonce     *big.Int
}

// DepositmanagerABI is the input ABI used to generate the binding from.
const DepositmanagerABI = "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_registryAddr\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"constant\":true,\"inputs\":[],\"name\":\"ZERO_BYTES32\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"accountsTree\",\"outputs\":[{\"internalType\":\"contractIncrementalTree\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"depositSubtreeHeight\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"governance\",\"outputs\":[{\"internalType\":\"contractGovernance\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"logger\",\"outputs\":[{\"internalType\":\"contractLogger\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"merkleUtils\",\"outputs\":[{\"internalType\":\"contractMerkleTreeUtils\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"nameRegistry\",\"outputs\":[{\"internalType\":\"contractNameRegistry\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"name\":\"pendingDeposits\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"queueNumber\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"tokenContract\",\"outputs\":[{\"internalType\":\"contractIERC20\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"tokenRegistry\",\"outputs\":[{\"internalType\":\"contractITokenRegistry\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[],\"name\":\"isDepositPaused\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_amount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_tokenType\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"_pubkey\",\"type\":\"bytes\"}],\"name\":\"deposit\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"internalType\":\"address\",\"name\":\"_destination\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"_amount\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_tokenType\",\"type\":\"uint256\"},{\"internalType\":\"bytes\",\"name\":\"_pubkey\",\"type\":\"bytes\"}],\"name\":\"depositFor\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"constant\":false,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_subTreeDepth\",\"type\":\"uint256\"},{\"components\":[{\"components\":[{\"internalType\":\"uint256\",\"name\":\"pathToAccount\",\"type\":\"uint256\"},{\"components\":[{\"internalType\":\"uint256\",\"name\":\"ID\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"tokenType\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"balance\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"nonce\",\"type\":\"uint256\"}],\"internalType\":\"structTypes.UserAccount\",\"name\":\"account\",\"type\":\"tuple\"}],\"internalType\":\"structTypes.AccountInclusionProof\",\"name\":\"accountIP\",\"type\":\"tuple\"},{\"internalType\":\"bytes32[]\",\"name\":\"siblings\",\"type\":\"bytes32[]\"}],\"internalType\":\"structTypes.AccountMerkleProof\",\"name\":\"_zero_account_mp\",\"type\":\"tuple\"},{\"internalType\":\"bytes32\",\"name\":\"latestBalanceTree\",\"type\":\"bytes32\"}],\"name\":\"finaliseDeposits\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]"

// Depositmanager is an auto generated Go binding around an Ethereum contract.
type Depositmanager struct {
	DepositmanagerCaller     // Read-only binding to the contract
	DepositmanagerTransactor // Write-only binding to the contract
	DepositmanagerFilterer   // Log filterer for contract events
}

// DepositmanagerCaller is an auto generated read-only Go binding around an Ethereum contract.
type DepositmanagerCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// DepositmanagerTransactor is an auto generated write-only Go binding around an Ethereum contract.
type DepositmanagerTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// DepositmanagerFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type DepositmanagerFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// DepositmanagerSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type DepositmanagerSession struct {
	Contract     *Depositmanager   // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// DepositmanagerCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type DepositmanagerCallerSession struct {
	Contract *DepositmanagerCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts         // Call options to use throughout this session
}

// DepositmanagerTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type DepositmanagerTransactorSession struct {
	Contract     *DepositmanagerTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts         // Transaction auth options to use throughout this session
}

// DepositmanagerRaw is an auto generated low-level Go binding around an Ethereum contract.
type DepositmanagerRaw struct {
	Contract *Depositmanager // Generic contract binding to access the raw methods on
}

// DepositmanagerCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type DepositmanagerCallerRaw struct {
	Contract *DepositmanagerCaller // Generic read-only contract binding to access the raw methods on
}

// DepositmanagerTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type DepositmanagerTransactorRaw struct {
	Contract *DepositmanagerTransactor // Generic write-only contract binding to access the raw methods on
}

// NewDepositmanager creates a new instance of Depositmanager, bound to a specific deployed contract.
func NewDepositmanager(address common.Address, backend bind.ContractBackend) (*Depositmanager, error) {
	contract, err := bindDepositmanager(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Depositmanager{DepositmanagerCaller: DepositmanagerCaller{contract: contract}, DepositmanagerTransactor: DepositmanagerTransactor{contract: contract}, DepositmanagerFilterer: DepositmanagerFilterer{contract: contract}}, nil
}

// NewDepositmanagerCaller creates a new read-only instance of Depositmanager, bound to a specific deployed contract.
func NewDepositmanagerCaller(address common.Address, caller bind.ContractCaller) (*DepositmanagerCaller, error) {
	contract, err := bindDepositmanager(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &DepositmanagerCaller{contract: contract}, nil
}

// NewDepositmanagerTransactor creates a new write-only instance of Depositmanager, bound to a specific deployed contract.
func NewDepositmanagerTransactor(address common.Address, transactor bind.ContractTransactor) (*DepositmanagerTransactor, error) {
	contract, err := bindDepositmanager(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &DepositmanagerTransactor{contract: contract}, nil
}

// NewDepositmanagerFilterer creates a new log filterer instance of Depositmanager, bound to a specific deployed contract.
func NewDepositmanagerFilterer(address common.Address, filterer bind.ContractFilterer) (*DepositmanagerFilterer, error) {
	contract, err := bindDepositmanager(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &DepositmanagerFilterer{contract: contract}, nil
}

// bindDepositmanager binds a generic wrapper to an already deployed contract.
func bindDepositmanager(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(DepositmanagerABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Depositmanager *DepositmanagerRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _Depositmanager.Contract.DepositmanagerCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Depositmanager *DepositmanagerRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Depositmanager.Contract.DepositmanagerTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Depositmanager *DepositmanagerRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Depositmanager.Contract.DepositmanagerTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Depositmanager *DepositmanagerCallerRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _Depositmanager.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Depositmanager *DepositmanagerTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Depositmanager.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Depositmanager *DepositmanagerTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Depositmanager.Contract.contract.Transact(opts, method, params...)
}

// ZEROBYTES32 is a free data retrieval call binding the contract method 0x069321b0.
//
// Solidity: function ZERO_BYTES32() view returns(bytes32)
func (_Depositmanager *DepositmanagerCaller) ZEROBYTES32(opts *bind.CallOpts) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "ZERO_BYTES32")
	return *ret0, err
}

// ZEROBYTES32 is a free data retrieval call binding the contract method 0x069321b0.
//
// Solidity: function ZERO_BYTES32() view returns(bytes32)
func (_Depositmanager *DepositmanagerSession) ZEROBYTES32() ([32]byte, error) {
	return _Depositmanager.Contract.ZEROBYTES32(&_Depositmanager.CallOpts)
}

// ZEROBYTES32 is a free data retrieval call binding the contract method 0x069321b0.
//
// Solidity: function ZERO_BYTES32() view returns(bytes32)
func (_Depositmanager *DepositmanagerCallerSession) ZEROBYTES32() ([32]byte, error) {
	return _Depositmanager.Contract.ZEROBYTES32(&_Depositmanager.CallOpts)
}

// AccountsTree is a free data retrieval call binding the contract method 0xae2926d4.
//
// Solidity: function accountsTree() view returns(address)
func (_Depositmanager *DepositmanagerCaller) AccountsTree(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "accountsTree")
	return *ret0, err
}

// AccountsTree is a free data retrieval call binding the contract method 0xae2926d4.
//
// Solidity: function accountsTree() view returns(address)
func (_Depositmanager *DepositmanagerSession) AccountsTree() (common.Address, error) {
	return _Depositmanager.Contract.AccountsTree(&_Depositmanager.CallOpts)
}

// AccountsTree is a free data retrieval call binding the contract method 0xae2926d4.
//
// Solidity: function accountsTree() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) AccountsTree() (common.Address, error) {
	return _Depositmanager.Contract.AccountsTree(&_Depositmanager.CallOpts)
}

// DepositSubtreeHeight is a free data retrieval call binding the contract method 0x2882dd98.
//
// Solidity: function depositSubtreeHeight() view returns(uint256)
func (_Depositmanager *DepositmanagerCaller) DepositSubtreeHeight(opts *bind.CallOpts) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "depositSubtreeHeight")
	return *ret0, err
}

// DepositSubtreeHeight is a free data retrieval call binding the contract method 0x2882dd98.
//
// Solidity: function depositSubtreeHeight() view returns(uint256)
func (_Depositmanager *DepositmanagerSession) DepositSubtreeHeight() (*big.Int, error) {
	return _Depositmanager.Contract.DepositSubtreeHeight(&_Depositmanager.CallOpts)
}

// DepositSubtreeHeight is a free data retrieval call binding the contract method 0x2882dd98.
//
// Solidity: function depositSubtreeHeight() view returns(uint256)
func (_Depositmanager *DepositmanagerCallerSession) DepositSubtreeHeight() (*big.Int, error) {
	return _Depositmanager.Contract.DepositSubtreeHeight(&_Depositmanager.CallOpts)
}

// Governance is a free data retrieval call binding the contract method 0x5aa6e675.
//
// Solidity: function governance() view returns(address)
func (_Depositmanager *DepositmanagerCaller) Governance(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "governance")
	return *ret0, err
}

// Governance is a free data retrieval call binding the contract method 0x5aa6e675.
//
// Solidity: function governance() view returns(address)
func (_Depositmanager *DepositmanagerSession) Governance() (common.Address, error) {
	return _Depositmanager.Contract.Governance(&_Depositmanager.CallOpts)
}

// Governance is a free data retrieval call binding the contract method 0x5aa6e675.
//
// Solidity: function governance() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) Governance() (common.Address, error) {
	return _Depositmanager.Contract.Governance(&_Depositmanager.CallOpts)
}

// Logger is a free data retrieval call binding the contract method 0xf24ccbfe.
//
// Solidity: function logger() view returns(address)
func (_Depositmanager *DepositmanagerCaller) Logger(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "logger")
	return *ret0, err
}

// Logger is a free data retrieval call binding the contract method 0xf24ccbfe.
//
// Solidity: function logger() view returns(address)
func (_Depositmanager *DepositmanagerSession) Logger() (common.Address, error) {
	return _Depositmanager.Contract.Logger(&_Depositmanager.CallOpts)
}

// Logger is a free data retrieval call binding the contract method 0xf24ccbfe.
//
// Solidity: function logger() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) Logger() (common.Address, error) {
	return _Depositmanager.Contract.Logger(&_Depositmanager.CallOpts)
}

// MerkleUtils is a free data retrieval call binding the contract method 0x47b0f08e.
//
// Solidity: function merkleUtils() view returns(address)
func (_Depositmanager *DepositmanagerCaller) MerkleUtils(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "merkleUtils")
	return *ret0, err
}

// MerkleUtils is a free data retrieval call binding the contract method 0x47b0f08e.
//
// Solidity: function merkleUtils() view returns(address)
func (_Depositmanager *DepositmanagerSession) MerkleUtils() (common.Address, error) {
	return _Depositmanager.Contract.MerkleUtils(&_Depositmanager.CallOpts)
}

// MerkleUtils is a free data retrieval call binding the contract method 0x47b0f08e.
//
// Solidity: function merkleUtils() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) MerkleUtils() (common.Address, error) {
	return _Depositmanager.Contract.MerkleUtils(&_Depositmanager.CallOpts)
}

// NameRegistry is a free data retrieval call binding the contract method 0x4eb7221a.
//
// Solidity: function nameRegistry() view returns(address)
func (_Depositmanager *DepositmanagerCaller) NameRegistry(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "nameRegistry")
	return *ret0, err
}

// NameRegistry is a free data retrieval call binding the contract method 0x4eb7221a.
//
// Solidity: function nameRegistry() view returns(address)
func (_Depositmanager *DepositmanagerSession) NameRegistry() (common.Address, error) {
	return _Depositmanager.Contract.NameRegistry(&_Depositmanager.CallOpts)
}

// NameRegistry is a free data retrieval call binding the contract method 0x4eb7221a.
//
// Solidity: function nameRegistry() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) NameRegistry() (common.Address, error) {
	return _Depositmanager.Contract.NameRegistry(&_Depositmanager.CallOpts)
}

// PendingDeposits is a free data retrieval call binding the contract method 0xa7932794.
//
// Solidity: function pendingDeposits(uint256 ) view returns(bytes32)
func (_Depositmanager *DepositmanagerCaller) PendingDeposits(opts *bind.CallOpts, arg0 *big.Int) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "pendingDeposits", arg0)
	return *ret0, err
}

// PendingDeposits is a free data retrieval call binding the contract method 0xa7932794.
//
// Solidity: function pendingDeposits(uint256 ) view returns(bytes32)
func (_Depositmanager *DepositmanagerSession) PendingDeposits(arg0 *big.Int) ([32]byte, error) {
	return _Depositmanager.Contract.PendingDeposits(&_Depositmanager.CallOpts, arg0)
}

// PendingDeposits is a free data retrieval call binding the contract method 0xa7932794.
//
// Solidity: function pendingDeposits(uint256 ) view returns(bytes32)
func (_Depositmanager *DepositmanagerCallerSession) PendingDeposits(arg0 *big.Int) ([32]byte, error) {
	return _Depositmanager.Contract.PendingDeposits(&_Depositmanager.CallOpts, arg0)
}

// QueueNumber is a free data retrieval call binding the contract method 0x2fa6779a.
//
// Solidity: function queueNumber() view returns(uint256)
func (_Depositmanager *DepositmanagerCaller) QueueNumber(opts *bind.CallOpts) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "queueNumber")
	return *ret0, err
}

// QueueNumber is a free data retrieval call binding the contract method 0x2fa6779a.
//
// Solidity: function queueNumber() view returns(uint256)
func (_Depositmanager *DepositmanagerSession) QueueNumber() (*big.Int, error) {
	return _Depositmanager.Contract.QueueNumber(&_Depositmanager.CallOpts)
}

// QueueNumber is a free data retrieval call binding the contract method 0x2fa6779a.
//
// Solidity: function queueNumber() view returns(uint256)
func (_Depositmanager *DepositmanagerCallerSession) QueueNumber() (*big.Int, error) {
	return _Depositmanager.Contract.QueueNumber(&_Depositmanager.CallOpts)
}

// TokenContract is a free data retrieval call binding the contract method 0x55a373d6.
//
// Solidity: function tokenContract() view returns(address)
func (_Depositmanager *DepositmanagerCaller) TokenContract(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "tokenContract")
	return *ret0, err
}

// TokenContract is a free data retrieval call binding the contract method 0x55a373d6.
//
// Solidity: function tokenContract() view returns(address)
func (_Depositmanager *DepositmanagerSession) TokenContract() (common.Address, error) {
	return _Depositmanager.Contract.TokenContract(&_Depositmanager.CallOpts)
}

// TokenContract is a free data retrieval call binding the contract method 0x55a373d6.
//
// Solidity: function tokenContract() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) TokenContract() (common.Address, error) {
	return _Depositmanager.Contract.TokenContract(&_Depositmanager.CallOpts)
}

// TokenRegistry is a free data retrieval call binding the contract method 0x9d23c4c7.
//
// Solidity: function tokenRegistry() view returns(address)
func (_Depositmanager *DepositmanagerCaller) TokenRegistry(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _Depositmanager.contract.Call(opts, out, "tokenRegistry")
	return *ret0, err
}

// TokenRegistry is a free data retrieval call binding the contract method 0x9d23c4c7.
//
// Solidity: function tokenRegistry() view returns(address)
func (_Depositmanager *DepositmanagerSession) TokenRegistry() (common.Address, error) {
	return _Depositmanager.Contract.TokenRegistry(&_Depositmanager.CallOpts)
}

// TokenRegistry is a free data retrieval call binding the contract method 0x9d23c4c7.
//
// Solidity: function tokenRegistry() view returns(address)
func (_Depositmanager *DepositmanagerCallerSession) TokenRegistry() (common.Address, error) {
	return _Depositmanager.Contract.TokenRegistry(&_Depositmanager.CallOpts)
}

// Deposit is a paid mutator transaction binding the contract method 0xaa0b7db7.
//
// Solidity: function deposit(uint256 _amount, uint256 _tokenType, bytes _pubkey) returns()
func (_Depositmanager *DepositmanagerTransactor) Deposit(opts *bind.TransactOpts, _amount *big.Int, _tokenType *big.Int, _pubkey []byte) (*types.Transaction, error) {
	return _Depositmanager.contract.Transact(opts, "deposit", _amount, _tokenType, _pubkey)
}

// Deposit is a paid mutator transaction binding the contract method 0xaa0b7db7.
//
// Solidity: function deposit(uint256 _amount, uint256 _tokenType, bytes _pubkey) returns()
func (_Depositmanager *DepositmanagerSession) Deposit(_amount *big.Int, _tokenType *big.Int, _pubkey []byte) (*types.Transaction, error) {
	return _Depositmanager.Contract.Deposit(&_Depositmanager.TransactOpts, _amount, _tokenType, _pubkey)
}

// Deposit is a paid mutator transaction binding the contract method 0xaa0b7db7.
//
// Solidity: function deposit(uint256 _amount, uint256 _tokenType, bytes _pubkey) returns()
func (_Depositmanager *DepositmanagerTransactorSession) Deposit(_amount *big.Int, _tokenType *big.Int, _pubkey []byte) (*types.Transaction, error) {
	return _Depositmanager.Contract.Deposit(&_Depositmanager.TransactOpts, _amount, _tokenType, _pubkey)
}

// DepositFor is a paid mutator transaction binding the contract method 0x1f8eb3e8.
//
// Solidity: function depositFor(address _destination, uint256 _amount, uint256 _tokenType, bytes _pubkey) returns()
func (_Depositmanager *DepositmanagerTransactor) DepositFor(opts *bind.TransactOpts, _destination common.Address, _amount *big.Int, _tokenType *big.Int, _pubkey []byte) (*types.Transaction, error) {
	return _Depositmanager.contract.Transact(opts, "depositFor", _destination, _amount, _tokenType, _pubkey)
}

// DepositFor is a paid mutator transaction binding the contract method 0x1f8eb3e8.
//
// Solidity: function depositFor(address _destination, uint256 _amount, uint256 _tokenType, bytes _pubkey) returns()
func (_Depositmanager *DepositmanagerSession) DepositFor(_destination common.Address, _amount *big.Int, _tokenType *big.Int, _pubkey []byte) (*types.Transaction, error) {
	return _Depositmanager.Contract.DepositFor(&_Depositmanager.TransactOpts, _destination, _amount, _tokenType, _pubkey)
}

// DepositFor is a paid mutator transaction binding the contract method 0x1f8eb3e8.
//
// Solidity: function depositFor(address _destination, uint256 _amount, uint256 _tokenType, bytes _pubkey) returns()
func (_Depositmanager *DepositmanagerTransactorSession) DepositFor(_destination common.Address, _amount *big.Int, _tokenType *big.Int, _pubkey []byte) (*types.Transaction, error) {
	return _Depositmanager.Contract.DepositFor(&_Depositmanager.TransactOpts, _destination, _amount, _tokenType, _pubkey)
}

// FinaliseDeposits is a paid mutator transaction binding the contract method 0x4e59adc9.
//
// Solidity: function finaliseDeposits(uint256 _subTreeDepth, TypesAccountMerkleProof _zero_account_mp, bytes32 latestBalanceTree) returns(bytes32)
func (_Depositmanager *DepositmanagerTransactor) FinaliseDeposits(opts *bind.TransactOpts, _subTreeDepth *big.Int, _zero_account_mp TypesAccountMerkleProof, latestBalanceTree [32]byte) (*types.Transaction, error) {
	return _Depositmanager.contract.Transact(opts, "finaliseDeposits", _subTreeDepth, _zero_account_mp, latestBalanceTree)
}

// FinaliseDeposits is a paid mutator transaction binding the contract method 0x4e59adc9.
//
// Solidity: function finaliseDeposits(uint256 _subTreeDepth, TypesAccountMerkleProof _zero_account_mp, bytes32 latestBalanceTree) returns(bytes32)
func (_Depositmanager *DepositmanagerSession) FinaliseDeposits(_subTreeDepth *big.Int, _zero_account_mp TypesAccountMerkleProof, latestBalanceTree [32]byte) (*types.Transaction, error) {
	return _Depositmanager.Contract.FinaliseDeposits(&_Depositmanager.TransactOpts, _subTreeDepth, _zero_account_mp, latestBalanceTree)
}

// FinaliseDeposits is a paid mutator transaction binding the contract method 0x4e59adc9.
//
// Solidity: function finaliseDeposits(uint256 _subTreeDepth, TypesAccountMerkleProof _zero_account_mp, bytes32 latestBalanceTree) returns(bytes32)
func (_Depositmanager *DepositmanagerTransactorSession) FinaliseDeposits(_subTreeDepth *big.Int, _zero_account_mp TypesAccountMerkleProof, latestBalanceTree [32]byte) (*types.Transaction, error) {
	return _Depositmanager.Contract.FinaliseDeposits(&_Depositmanager.TransactOpts, _subTreeDepth, _zero_account_mp, latestBalanceTree)
}

// IsDepositPaused is a paid mutator transaction binding the contract method 0xf560d0b2.
//
// Solidity: function isDepositPaused() returns(bool)
func (_Depositmanager *DepositmanagerTransactor) IsDepositPaused(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Depositmanager.contract.Transact(opts, "isDepositPaused")
}

// IsDepositPaused is a paid mutator transaction binding the contract method 0xf560d0b2.
//
// Solidity: function isDepositPaused() returns(bool)
func (_Depositmanager *DepositmanagerSession) IsDepositPaused() (*types.Transaction, error) {
	return _Depositmanager.Contract.IsDepositPaused(&_Depositmanager.TransactOpts)
}

// IsDepositPaused is a paid mutator transaction binding the contract method 0xf560d0b2.
//
// Solidity: function isDepositPaused() returns(bool)
func (_Depositmanager *DepositmanagerTransactorSession) IsDepositPaused() (*types.Transaction, error) {
	return _Depositmanager.Contract.IsDepositPaused(&_Depositmanager.TransactOpts)
}
