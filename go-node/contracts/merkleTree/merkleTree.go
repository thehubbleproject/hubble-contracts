// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package merkleTree

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

// MerkleTreeABI is the input ABI used to generate the binding from.
const MerkleTreeABI = "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_registryAddr\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"constant\":true,\"inputs\":[],\"name\":\"MAX_DEPTH\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"name\":\"defaultHashes\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"governance\",\"outputs\":[{\"internalType\":\"contractGovernance\",\"name\":\"\",\"type\":\"address\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"getZeroRoot\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[],\"name\":\"getMaxTreeDepth\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"index\",\"type\":\"uint256\"}],\"name\":\"getRoot\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"index\",\"type\":\"uint256\"}],\"name\":\"getDefaultHashAtLevel\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes\",\"name\":\"data\",\"type\":\"bytes\"}],\"name\":\"keecakHash\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes[]\",\"name\":\"_dataBlocks\",\"type\":\"bytes[]\"}],\"name\":\"getMerkleRoot\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32[]\",\"name\":\"nodes\",\"type\":\"bytes32[]\"}],\"name\":\"getMerkleRootFromLeaves\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes\",\"name\":\"_dataBlock\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"_path\",\"type\":\"uint256\"},{\"internalType\":\"bytes32[]\",\"name\":\"_siblings\",\"type\":\"bytes32[]\"}],\"name\":\"computeInclusionProofRoot\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_leaf\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"_path\",\"type\":\"uint256\"},{\"internalType\":\"bytes32[]\",\"name\":\"_siblings\",\"type\":\"bytes32[]\"}],\"name\":\"computeInclusionProofRootWithLeaf\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_root\",\"type\":\"bytes32\"},{\"internalType\":\"bytes\",\"name\":\"_dataBlock\",\"type\":\"bytes\"},{\"internalType\":\"uint256\",\"name\":\"_path\",\"type\":\"uint256\"},{\"internalType\":\"bytes32[]\",\"name\":\"_siblings\",\"type\":\"bytes32[]\"}],\"name\":\"verify\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_root\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"_leaf\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"_path\",\"type\":\"uint256\"},{\"internalType\":\"bytes32[]\",\"name\":\"_siblings\",\"type\":\"bytes32[]\"}],\"name\":\"verifyLeaf\",\"outputs\":[{\"internalType\":\"bool\",\"name\":\"\",\"type\":\"bool\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_leaf\",\"type\":\"bytes32\"},{\"internalType\":\"uint256\",\"name\":\"_path\",\"type\":\"uint256\"},{\"internalType\":\"bytes32[]\",\"name\":\"_siblings\",\"type\":\"bytes32[]\"}],\"name\":\"updateLeafWithSiblings\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_left\",\"type\":\"bytes32\"},{\"internalType\":\"bytes32\",\"name\":\"_right\",\"type\":\"bytes32\"}],\"name\":\"getParent\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_intVal\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_index\",\"type\":\"uint256\"}],\"name\":\"getNthBitFromRight\",\"outputs\":[{\"internalType\":\"uint8\",\"name\":\"\",\"type\":\"uint8\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_parent\",\"type\":\"bytes32\"}],\"name\":\"getLeftSiblingKey\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"bytes32\",\"name\":\"_parent\",\"type\":\"bytes32\"}],\"name\":\"getRightSiblingKey\",\"outputs\":[{\"internalType\":\"bytes32\",\"name\":\"\",\"type\":\"bytes32\"}],\"payable\":false,\"stateMutability\":\"pure\",\"type\":\"function\"},{\"constant\":true,\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"path\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"height\",\"type\":\"uint256\"}],\"name\":\"pathToIndex\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"payable\":false,\"stateMutability\":\"view\",\"type\":\"function\"}]"

// MerkleTree is an auto generated Go binding around an Ethereum contract.
type MerkleTree struct {
	MerkleTreeCaller     // Read-only binding to the contract
	MerkleTreeTransactor // Write-only binding to the contract
	MerkleTreeFilterer   // Log filterer for contract events
}

// MerkleTreeCaller is an auto generated read-only Go binding around an Ethereum contract.
type MerkleTreeCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// MerkleTreeTransactor is an auto generated write-only Go binding around an Ethereum contract.
type MerkleTreeTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// MerkleTreeFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type MerkleTreeFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// MerkleTreeSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type MerkleTreeSession struct {
	Contract     *MerkleTree       // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// MerkleTreeCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type MerkleTreeCallerSession struct {
	Contract *MerkleTreeCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts     // Call options to use throughout this session
}

// MerkleTreeTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type MerkleTreeTransactorSession struct {
	Contract     *MerkleTreeTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts     // Transaction auth options to use throughout this session
}

// MerkleTreeRaw is an auto generated low-level Go binding around an Ethereum contract.
type MerkleTreeRaw struct {
	Contract *MerkleTree // Generic contract binding to access the raw methods on
}

// MerkleTreeCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type MerkleTreeCallerRaw struct {
	Contract *MerkleTreeCaller // Generic read-only contract binding to access the raw methods on
}

// MerkleTreeTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type MerkleTreeTransactorRaw struct {
	Contract *MerkleTreeTransactor // Generic write-only contract binding to access the raw methods on
}

// NewMerkleTree creates a new instance of MerkleTree, bound to a specific deployed contract.
func NewMerkleTree(address common.Address, backend bind.ContractBackend) (*MerkleTree, error) {
	contract, err := bindMerkleTree(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &MerkleTree{MerkleTreeCaller: MerkleTreeCaller{contract: contract}, MerkleTreeTransactor: MerkleTreeTransactor{contract: contract}, MerkleTreeFilterer: MerkleTreeFilterer{contract: contract}}, nil
}

// NewMerkleTreeCaller creates a new read-only instance of MerkleTree, bound to a specific deployed contract.
func NewMerkleTreeCaller(address common.Address, caller bind.ContractCaller) (*MerkleTreeCaller, error) {
	contract, err := bindMerkleTree(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &MerkleTreeCaller{contract: contract}, nil
}

// NewMerkleTreeTransactor creates a new write-only instance of MerkleTree, bound to a specific deployed contract.
func NewMerkleTreeTransactor(address common.Address, transactor bind.ContractTransactor) (*MerkleTreeTransactor, error) {
	contract, err := bindMerkleTree(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &MerkleTreeTransactor{contract: contract}, nil
}

// NewMerkleTreeFilterer creates a new log filterer instance of MerkleTree, bound to a specific deployed contract.
func NewMerkleTreeFilterer(address common.Address, filterer bind.ContractFilterer) (*MerkleTreeFilterer, error) {
	contract, err := bindMerkleTree(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &MerkleTreeFilterer{contract: contract}, nil
}

// bindMerkleTree binds a generic wrapper to an already deployed contract.
func bindMerkleTree(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(MerkleTreeABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_MerkleTree *MerkleTreeRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _MerkleTree.Contract.MerkleTreeCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_MerkleTree *MerkleTreeRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _MerkleTree.Contract.MerkleTreeTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_MerkleTree *MerkleTreeRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _MerkleTree.Contract.MerkleTreeTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_MerkleTree *MerkleTreeCallerRaw) Call(opts *bind.CallOpts, result interface{}, method string, params ...interface{}) error {
	return _MerkleTree.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_MerkleTree *MerkleTreeTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _MerkleTree.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_MerkleTree *MerkleTreeTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _MerkleTree.Contract.contract.Transact(opts, method, params...)
}

// MAXDEPTH is a free data retrieval call binding the contract method 0xa27154ba.
//
// Solidity: function MAX_DEPTH() view returns(uint256)
func (_MerkleTree *MerkleTreeCaller) MAXDEPTH(opts *bind.CallOpts) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "MAX_DEPTH")
	return *ret0, err
}

// MAXDEPTH is a free data retrieval call binding the contract method 0xa27154ba.
//
// Solidity: function MAX_DEPTH() view returns(uint256)
func (_MerkleTree *MerkleTreeSession) MAXDEPTH() (*big.Int, error) {
	return _MerkleTree.Contract.MAXDEPTH(&_MerkleTree.CallOpts)
}

// MAXDEPTH is a free data retrieval call binding the contract method 0xa27154ba.
//
// Solidity: function MAX_DEPTH() view returns(uint256)
func (_MerkleTree *MerkleTreeCallerSession) MAXDEPTH() (*big.Int, error) {
	return _MerkleTree.Contract.MAXDEPTH(&_MerkleTree.CallOpts)
}

// ComputeInclusionProofRoot is a free data retrieval call binding the contract method 0x99ae9309.
//
// Solidity: function computeInclusionProofRoot(bytes _dataBlock, uint256 _path, bytes32[] _siblings) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) ComputeInclusionProofRoot(opts *bind.CallOpts, _dataBlock []byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "computeInclusionProofRoot", _dataBlock, _path, _siblings)
	return *ret0, err
}

// ComputeInclusionProofRoot is a free data retrieval call binding the contract method 0x99ae9309.
//
// Solidity: function computeInclusionProofRoot(bytes _dataBlock, uint256 _path, bytes32[] _siblings) pure returns(bytes32)
func (_MerkleTree *MerkleTreeSession) ComputeInclusionProofRoot(_dataBlock []byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.ComputeInclusionProofRoot(&_MerkleTree.CallOpts, _dataBlock, _path, _siblings)
}

// ComputeInclusionProofRoot is a free data retrieval call binding the contract method 0x99ae9309.
//
// Solidity: function computeInclusionProofRoot(bytes _dataBlock, uint256 _path, bytes32[] _siblings) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) ComputeInclusionProofRoot(_dataBlock []byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.ComputeInclusionProofRoot(&_MerkleTree.CallOpts, _dataBlock, _path, _siblings)
}

// ComputeInclusionProofRootWithLeaf is a free data retrieval call binding the contract method 0x8530997c.
//
// Solidity: function computeInclusionProofRootWithLeaf(bytes32 _leaf, uint256 _path, bytes32[] _siblings) view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) ComputeInclusionProofRootWithLeaf(opts *bind.CallOpts, _leaf [32]byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "computeInclusionProofRootWithLeaf", _leaf, _path, _siblings)
	return *ret0, err
}

// ComputeInclusionProofRootWithLeaf is a free data retrieval call binding the contract method 0x8530997c.
//
// Solidity: function computeInclusionProofRootWithLeaf(bytes32 _leaf, uint256 _path, bytes32[] _siblings) view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) ComputeInclusionProofRootWithLeaf(_leaf [32]byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.ComputeInclusionProofRootWithLeaf(&_MerkleTree.CallOpts, _leaf, _path, _siblings)
}

// ComputeInclusionProofRootWithLeaf is a free data retrieval call binding the contract method 0x8530997c.
//
// Solidity: function computeInclusionProofRootWithLeaf(bytes32 _leaf, uint256 _path, bytes32[] _siblings) view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) ComputeInclusionProofRootWithLeaf(_leaf [32]byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.ComputeInclusionProofRootWithLeaf(&_MerkleTree.CallOpts, _leaf, _path, _siblings)
}

// DefaultHashes is a free data retrieval call binding the contract method 0x48419ad8.
//
// Solidity: function defaultHashes(uint256 ) view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) DefaultHashes(opts *bind.CallOpts, arg0 *big.Int) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "defaultHashes", arg0)
	return *ret0, err
}

// DefaultHashes is a free data retrieval call binding the contract method 0x48419ad8.
//
// Solidity: function defaultHashes(uint256 ) view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) DefaultHashes(arg0 *big.Int) ([32]byte, error) {
	return _MerkleTree.Contract.DefaultHashes(&_MerkleTree.CallOpts, arg0)
}

// DefaultHashes is a free data retrieval call binding the contract method 0x48419ad8.
//
// Solidity: function defaultHashes(uint256 ) view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) DefaultHashes(arg0 *big.Int) ([32]byte, error) {
	return _MerkleTree.Contract.DefaultHashes(&_MerkleTree.CallOpts, arg0)
}

// GetDefaultHashAtLevel is a free data retrieval call binding the contract method 0x17af62d2.
//
// Solidity: function getDefaultHashAtLevel(uint256 index) view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetDefaultHashAtLevel(opts *bind.CallOpts, index *big.Int) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getDefaultHashAtLevel", index)
	return *ret0, err
}

// GetDefaultHashAtLevel is a free data retrieval call binding the contract method 0x17af62d2.
//
// Solidity: function getDefaultHashAtLevel(uint256 index) view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetDefaultHashAtLevel(index *big.Int) ([32]byte, error) {
	return _MerkleTree.Contract.GetDefaultHashAtLevel(&_MerkleTree.CallOpts, index)
}

// GetDefaultHashAtLevel is a free data retrieval call binding the contract method 0x17af62d2.
//
// Solidity: function getDefaultHashAtLevel(uint256 index) view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetDefaultHashAtLevel(index *big.Int) ([32]byte, error) {
	return _MerkleTree.Contract.GetDefaultHashAtLevel(&_MerkleTree.CallOpts, index)
}

// GetLeftSiblingKey is a free data retrieval call binding the contract method 0xdf7c7263.
//
// Solidity: function getLeftSiblingKey(bytes32 _parent) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetLeftSiblingKey(opts *bind.CallOpts, _parent [32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getLeftSiblingKey", _parent)
	return *ret0, err
}

// GetLeftSiblingKey is a free data retrieval call binding the contract method 0xdf7c7263.
//
// Solidity: function getLeftSiblingKey(bytes32 _parent) pure returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetLeftSiblingKey(_parent [32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetLeftSiblingKey(&_MerkleTree.CallOpts, _parent)
}

// GetLeftSiblingKey is a free data retrieval call binding the contract method 0xdf7c7263.
//
// Solidity: function getLeftSiblingKey(bytes32 _parent) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetLeftSiblingKey(_parent [32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetLeftSiblingKey(&_MerkleTree.CallOpts, _parent)
}

// GetMaxTreeDepth is a free data retrieval call binding the contract method 0xe5f8e87b.
//
// Solidity: function getMaxTreeDepth() view returns(uint256)
func (_MerkleTree *MerkleTreeCaller) GetMaxTreeDepth(opts *bind.CallOpts) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getMaxTreeDepth")
	return *ret0, err
}

// GetMaxTreeDepth is a free data retrieval call binding the contract method 0xe5f8e87b.
//
// Solidity: function getMaxTreeDepth() view returns(uint256)
func (_MerkleTree *MerkleTreeSession) GetMaxTreeDepth() (*big.Int, error) {
	return _MerkleTree.Contract.GetMaxTreeDepth(&_MerkleTree.CallOpts)
}

// GetMaxTreeDepth is a free data retrieval call binding the contract method 0xe5f8e87b.
//
// Solidity: function getMaxTreeDepth() view returns(uint256)
func (_MerkleTree *MerkleTreeCallerSession) GetMaxTreeDepth() (*big.Int, error) {
	return _MerkleTree.Contract.GetMaxTreeDepth(&_MerkleTree.CallOpts)
}

// GetMerkleRoot is a free data retrieval call binding the contract method 0x40ff34ef.
//
// Solidity: function getMerkleRoot(bytes[] _dataBlocks) view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetMerkleRoot(opts *bind.CallOpts, _dataBlocks [][]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getMerkleRoot", _dataBlocks)
	return *ret0, err
}

// GetMerkleRoot is a free data retrieval call binding the contract method 0x40ff34ef.
//
// Solidity: function getMerkleRoot(bytes[] _dataBlocks) view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetMerkleRoot(_dataBlocks [][]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetMerkleRoot(&_MerkleTree.CallOpts, _dataBlocks)
}

// GetMerkleRoot is a free data retrieval call binding the contract method 0x40ff34ef.
//
// Solidity: function getMerkleRoot(bytes[] _dataBlocks) view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetMerkleRoot(_dataBlocks [][]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetMerkleRoot(&_MerkleTree.CallOpts, _dataBlocks)
}

// GetMerkleRootFromLeaves is a free data retrieval call binding the contract method 0x978b1f83.
//
// Solidity: function getMerkleRootFromLeaves(bytes32[] nodes) view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetMerkleRootFromLeaves(opts *bind.CallOpts, nodes [][32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getMerkleRootFromLeaves", nodes)
	return *ret0, err
}

// GetMerkleRootFromLeaves is a free data retrieval call binding the contract method 0x978b1f83.
//
// Solidity: function getMerkleRootFromLeaves(bytes32[] nodes) view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetMerkleRootFromLeaves(nodes [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetMerkleRootFromLeaves(&_MerkleTree.CallOpts, nodes)
}

// GetMerkleRootFromLeaves is a free data retrieval call binding the contract method 0x978b1f83.
//
// Solidity: function getMerkleRootFromLeaves(bytes32[] nodes) view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetMerkleRootFromLeaves(nodes [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetMerkleRootFromLeaves(&_MerkleTree.CallOpts, nodes)
}

// GetNthBitFromRight is a free data retrieval call binding the contract method 0xdb0787cb.
//
// Solidity: function getNthBitFromRight(uint256 _intVal, uint256 _index) pure returns(uint8)
func (_MerkleTree *MerkleTreeCaller) GetNthBitFromRight(opts *bind.CallOpts, _intVal *big.Int, _index *big.Int) (uint8, error) {
	var (
		ret0 = new(uint8)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getNthBitFromRight", _intVal, _index)
	return *ret0, err
}

// GetNthBitFromRight is a free data retrieval call binding the contract method 0xdb0787cb.
//
// Solidity: function getNthBitFromRight(uint256 _intVal, uint256 _index) pure returns(uint8)
func (_MerkleTree *MerkleTreeSession) GetNthBitFromRight(_intVal *big.Int, _index *big.Int) (uint8, error) {
	return _MerkleTree.Contract.GetNthBitFromRight(&_MerkleTree.CallOpts, _intVal, _index)
}

// GetNthBitFromRight is a free data retrieval call binding the contract method 0xdb0787cb.
//
// Solidity: function getNthBitFromRight(uint256 _intVal, uint256 _index) pure returns(uint8)
func (_MerkleTree *MerkleTreeCallerSession) GetNthBitFromRight(_intVal *big.Int, _index *big.Int) (uint8, error) {
	return _MerkleTree.Contract.GetNthBitFromRight(&_MerkleTree.CallOpts, _intVal, _index)
}

// GetParent is a free data retrieval call binding the contract method 0x8f6485fb.
//
// Solidity: function getParent(bytes32 _left, bytes32 _right) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetParent(opts *bind.CallOpts, _left [32]byte, _right [32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getParent", _left, _right)
	return *ret0, err
}

// GetParent is a free data retrieval call binding the contract method 0x8f6485fb.
//
// Solidity: function getParent(bytes32 _left, bytes32 _right) pure returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetParent(_left [32]byte, _right [32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetParent(&_MerkleTree.CallOpts, _left, _right)
}

// GetParent is a free data retrieval call binding the contract method 0x8f6485fb.
//
// Solidity: function getParent(bytes32 _left, bytes32 _right) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetParent(_left [32]byte, _right [32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetParent(&_MerkleTree.CallOpts, _left, _right)
}

// GetRightSiblingKey is a free data retrieval call binding the contract method 0xe913e47f.
//
// Solidity: function getRightSiblingKey(bytes32 _parent) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetRightSiblingKey(opts *bind.CallOpts, _parent [32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getRightSiblingKey", _parent)
	return *ret0, err
}

// GetRightSiblingKey is a free data retrieval call binding the contract method 0xe913e47f.
//
// Solidity: function getRightSiblingKey(bytes32 _parent) pure returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetRightSiblingKey(_parent [32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetRightSiblingKey(&_MerkleTree.CallOpts, _parent)
}

// GetRightSiblingKey is a free data retrieval call binding the contract method 0xe913e47f.
//
// Solidity: function getRightSiblingKey(bytes32 _parent) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetRightSiblingKey(_parent [32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.GetRightSiblingKey(&_MerkleTree.CallOpts, _parent)
}

// GetRoot is a free data retrieval call binding the contract method 0x9b24b3b0.
//
// Solidity: function getRoot(uint256 index) view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetRoot(opts *bind.CallOpts, index *big.Int) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getRoot", index)
	return *ret0, err
}

// GetRoot is a free data retrieval call binding the contract method 0x9b24b3b0.
//
// Solidity: function getRoot(uint256 index) view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetRoot(index *big.Int) ([32]byte, error) {
	return _MerkleTree.Contract.GetRoot(&_MerkleTree.CallOpts, index)
}

// GetRoot is a free data retrieval call binding the contract method 0x9b24b3b0.
//
// Solidity: function getRoot(uint256 index) view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetRoot(index *big.Int) ([32]byte, error) {
	return _MerkleTree.Contract.GetRoot(&_MerkleTree.CallOpts, index)
}

// GetZeroRoot is a free data retrieval call binding the contract method 0x0cb0a343.
//
// Solidity: function getZeroRoot() view returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) GetZeroRoot(opts *bind.CallOpts) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "getZeroRoot")
	return *ret0, err
}

// GetZeroRoot is a free data retrieval call binding the contract method 0x0cb0a343.
//
// Solidity: function getZeroRoot() view returns(bytes32)
func (_MerkleTree *MerkleTreeSession) GetZeroRoot() ([32]byte, error) {
	return _MerkleTree.Contract.GetZeroRoot(&_MerkleTree.CallOpts)
}

// GetZeroRoot is a free data retrieval call binding the contract method 0x0cb0a343.
//
// Solidity: function getZeroRoot() view returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) GetZeroRoot() ([32]byte, error) {
	return _MerkleTree.Contract.GetZeroRoot(&_MerkleTree.CallOpts)
}

// Governance is a free data retrieval call binding the contract method 0x5aa6e675.
//
// Solidity: function governance() view returns(address)
func (_MerkleTree *MerkleTreeCaller) Governance(opts *bind.CallOpts) (common.Address, error) {
	var (
		ret0 = new(common.Address)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "governance")
	return *ret0, err
}

// Governance is a free data retrieval call binding the contract method 0x5aa6e675.
//
// Solidity: function governance() view returns(address)
func (_MerkleTree *MerkleTreeSession) Governance() (common.Address, error) {
	return _MerkleTree.Contract.Governance(&_MerkleTree.CallOpts)
}

// Governance is a free data retrieval call binding the contract method 0x5aa6e675.
//
// Solidity: function governance() view returns(address)
func (_MerkleTree *MerkleTreeCallerSession) Governance() (common.Address, error) {
	return _MerkleTree.Contract.Governance(&_MerkleTree.CallOpts)
}

// KeecakHash is a free data retrieval call binding the contract method 0x747e2d1c.
//
// Solidity: function keecakHash(bytes data) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) KeecakHash(opts *bind.CallOpts, data []byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "keecakHash", data)
	return *ret0, err
}

// KeecakHash is a free data retrieval call binding the contract method 0x747e2d1c.
//
// Solidity: function keecakHash(bytes data) pure returns(bytes32)
func (_MerkleTree *MerkleTreeSession) KeecakHash(data []byte) ([32]byte, error) {
	return _MerkleTree.Contract.KeecakHash(&_MerkleTree.CallOpts, data)
}

// KeecakHash is a free data retrieval call binding the contract method 0x747e2d1c.
//
// Solidity: function keecakHash(bytes data) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) KeecakHash(data []byte) ([32]byte, error) {
	return _MerkleTree.Contract.KeecakHash(&_MerkleTree.CallOpts, data)
}

// PathToIndex is a free data retrieval call binding the contract method 0x25ab625e.
//
// Solidity: function pathToIndex(uint256 path, uint256 height) view returns(uint256)
func (_MerkleTree *MerkleTreeCaller) PathToIndex(opts *bind.CallOpts, path *big.Int, height *big.Int) (*big.Int, error) {
	var (
		ret0 = new(*big.Int)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "pathToIndex", path, height)
	return *ret0, err
}

// PathToIndex is a free data retrieval call binding the contract method 0x25ab625e.
//
// Solidity: function pathToIndex(uint256 path, uint256 height) view returns(uint256)
func (_MerkleTree *MerkleTreeSession) PathToIndex(path *big.Int, height *big.Int) (*big.Int, error) {
	return _MerkleTree.Contract.PathToIndex(&_MerkleTree.CallOpts, path, height)
}

// PathToIndex is a free data retrieval call binding the contract method 0x25ab625e.
//
// Solidity: function pathToIndex(uint256 path, uint256 height) view returns(uint256)
func (_MerkleTree *MerkleTreeCallerSession) PathToIndex(path *big.Int, height *big.Int) (*big.Int, error) {
	return _MerkleTree.Contract.PathToIndex(&_MerkleTree.CallOpts, path, height)
}

// UpdateLeafWithSiblings is a free data retrieval call binding the contract method 0x5fed7127.
//
// Solidity: function updateLeafWithSiblings(bytes32 _leaf, uint256 _path, bytes32[] _siblings) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCaller) UpdateLeafWithSiblings(opts *bind.CallOpts, _leaf [32]byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	var (
		ret0 = new([32]byte)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "updateLeafWithSiblings", _leaf, _path, _siblings)
	return *ret0, err
}

// UpdateLeafWithSiblings is a free data retrieval call binding the contract method 0x5fed7127.
//
// Solidity: function updateLeafWithSiblings(bytes32 _leaf, uint256 _path, bytes32[] _siblings) pure returns(bytes32)
func (_MerkleTree *MerkleTreeSession) UpdateLeafWithSiblings(_leaf [32]byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.UpdateLeafWithSiblings(&_MerkleTree.CallOpts, _leaf, _path, _siblings)
}

// UpdateLeafWithSiblings is a free data retrieval call binding the contract method 0x5fed7127.
//
// Solidity: function updateLeafWithSiblings(bytes32 _leaf, uint256 _path, bytes32[] _siblings) pure returns(bytes32)
func (_MerkleTree *MerkleTreeCallerSession) UpdateLeafWithSiblings(_leaf [32]byte, _path *big.Int, _siblings [][32]byte) ([32]byte, error) {
	return _MerkleTree.Contract.UpdateLeafWithSiblings(&_MerkleTree.CallOpts, _leaf, _path, _siblings)
}

// Verify is a free data retrieval call binding the contract method 0x30d90a76.
//
// Solidity: function verify(bytes32 _root, bytes _dataBlock, uint256 _path, bytes32[] _siblings) view returns(bool)
func (_MerkleTree *MerkleTreeCaller) Verify(opts *bind.CallOpts, _root [32]byte, _dataBlock []byte, _path *big.Int, _siblings [][32]byte) (bool, error) {
	var (
		ret0 = new(bool)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "verify", _root, _dataBlock, _path, _siblings)
	return *ret0, err
}

// Verify is a free data retrieval call binding the contract method 0x30d90a76.
//
// Solidity: function verify(bytes32 _root, bytes _dataBlock, uint256 _path, bytes32[] _siblings) view returns(bool)
func (_MerkleTree *MerkleTreeSession) Verify(_root [32]byte, _dataBlock []byte, _path *big.Int, _siblings [][32]byte) (bool, error) {
	return _MerkleTree.Contract.Verify(&_MerkleTree.CallOpts, _root, _dataBlock, _path, _siblings)
}

// Verify is a free data retrieval call binding the contract method 0x30d90a76.
//
// Solidity: function verify(bytes32 _root, bytes _dataBlock, uint256 _path, bytes32[] _siblings) view returns(bool)
func (_MerkleTree *MerkleTreeCallerSession) Verify(_root [32]byte, _dataBlock []byte, _path *big.Int, _siblings [][32]byte) (bool, error) {
	return _MerkleTree.Contract.Verify(&_MerkleTree.CallOpts, _root, _dataBlock, _path, _siblings)
}

// VerifyLeaf is a free data retrieval call binding the contract method 0xf8b557b7.
//
// Solidity: function verifyLeaf(bytes32 _root, bytes32 _leaf, uint256 _path, bytes32[] _siblings) view returns(bool)
func (_MerkleTree *MerkleTreeCaller) VerifyLeaf(opts *bind.CallOpts, _root [32]byte, _leaf [32]byte, _path *big.Int, _siblings [][32]byte) (bool, error) {
	var (
		ret0 = new(bool)
	)
	out := ret0
	err := _MerkleTree.contract.Call(opts, out, "verifyLeaf", _root, _leaf, _path, _siblings)
	return *ret0, err
}

// VerifyLeaf is a free data retrieval call binding the contract method 0xf8b557b7.
//
// Solidity: function verifyLeaf(bytes32 _root, bytes32 _leaf, uint256 _path, bytes32[] _siblings) view returns(bool)
func (_MerkleTree *MerkleTreeSession) VerifyLeaf(_root [32]byte, _leaf [32]byte, _path *big.Int, _siblings [][32]byte) (bool, error) {
	return _MerkleTree.Contract.VerifyLeaf(&_MerkleTree.CallOpts, _root, _leaf, _path, _siblings)
}

// VerifyLeaf is a free data retrieval call binding the contract method 0xf8b557b7.
//
// Solidity: function verifyLeaf(bytes32 _root, bytes32 _leaf, uint256 _path, bytes32[] _siblings) view returns(bool)
func (_MerkleTree *MerkleTreeCallerSession) VerifyLeaf(_root [32]byte, _leaf [32]byte, _path *big.Int, _siblings [][32]byte) (bool, error) {
	return _MerkleTree.Contract.VerifyLeaf(&_MerkleTree.CallOpts, _root, _leaf, _path, _siblings)
}
