package core

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"math/big"

	"github.com/BOPR/common"
	"github.com/BOPR/contracts/rollup"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/jinzhu/gorm"
	gormbulk "github.com/t-tiger/gorm-bulk-insert"
)

// UserAccount is the user data stored on the node per user
type UserAccount struct {
	// ID is the path of the user account in the PDA Tree
	// Cannot be changed once created
	AccountID uint64 `gorm:"not null;index:AccountID"`

	// Token type of the user account
	// Cannot be changed once creation
	TokenType uint64 `gorm:"not null;default:0"`

	// Balance of the user account
	Balance uint64 `gorm:"not null;"`

	// Nonce of the account
	Nonce uint64 `gorm:"not null;"`

	// Public key for the user
	PublicKey string `gorm:"size:1000"`

	// PublicKeyHash = Hash(publicKey)
	PublicKeyHash string `gorm:""`

	// Path from root to leaf
	// NOTE: not a part of the leaf
	// Path is a string to that we can run LIKE queries
	Path string `gorm:"not null;index:Path"`

	// Pending = 0 means has deposit but not merged to balance tree
	// Active = 1
	// InActive = 2 => non leaf node
	// NonInitialised = 100
	Status uint64 `gorm:"not null;index:Status"`

	// Type of nodes
	// 1 => terminal
	// 0 => root
	// 2 => non terminal
	Type uint64 `gorm:"not null;index:Type"`

	// keccak hash of the node
	Hash string `gorm:"not null;index:Hash"`

	Level uint64 `gorm:"not null;index:Level"`
}

// NewUserAccount creates a new user account
func NewUserAccount(id, balance, tokenType, nonce, status uint64, pubkey, path string) *UserAccount {
	newAcccount := &UserAccount{
		AccountID: id,
		PublicKey: pubkey,
		Balance:   balance,
		TokenType: tokenType,
		Nonce:     nonce,
		Path:      path,
		Status:    status,
		Type:      TYPE_TERMINAL,
	}
	newAcccount.UpdatePath(newAcccount.Path)
	newAcccount.CreateAccountHash()
	return newAcccount
}

// NewAccountNode creates a new non-terminal user account, the only this useful in this is
// Path, Status, Hash, PubkeyHash
func NewAccountNode(path, hash, pubkeyHash string) *UserAccount {
	newAcccount := &UserAccount{
		AccountID:     ZERO,
		PublicKey:     "",
		PublicKeyHash: pubkeyHash,
		Balance:       ZERO,
		TokenType:     ZERO,
		Nonce:         ZERO,
		Path:          path,
		Status:        STATUS_ACTIVE,
		Type:          TYPE_NON_TERMINAL,
	}
	newAcccount.UpdatePath(newAcccount.Path)
	newAcccount.Hash = hash
	return newAcccount
}

// NewAccountNode creates a new terminal user account but in pending state
// It is to be used while adding new deposits while they are not finalised
func NewPendingUserAccount(id, balance, tokenType uint64, _pubkey string) *UserAccount {
	newAcccount := &UserAccount{
		AccountID: id,
		TokenType: tokenType,
		Balance:   balance,
		Nonce:     NONCE_ZERO,
		Path:      UNINITIALIZED_PATH,
		Status:    STATUS_PENDING,
		PublicKey: _pubkey,
		Type:      TYPE_TERMINAL,
	}
	newAcccount.UpdatePath(newAcccount.Path)
	newAcccount.CreateAccountHash()
	return newAcccount
}

func (acc *UserAccount) UpdatePath(path string) {
	acc.Path = path
	acc.Level = uint64(len(path))
}

func (acc *UserAccount) String() string {
	return fmt.Sprintf("ID: %d Bal: %d Path: %v Nonce: %v TokenType:%v NodeType: %d %v", acc.AccountID, acc.Balance, acc.Path, acc.Nonce, acc.TokenType, acc.Type, acc.Hash)
}

func (acc *UserAccount) ToABIAccount() rollup.TypesUserAccount {
	return rollup.TypesUserAccount{
		ID:        UintToBigInt(acc.AccountID),
		Balance:   UintToBigInt(acc.Balance),
		TokenType: UintToBigInt(acc.TokenType),
		Nonce:     UintToBigInt(acc.Nonce),
	}
}

func (acc *UserAccount) HashToByteArray() ByteArray {
	ba, err := HexToByteArray(acc.Hash)
	if err != nil {
		panic(err)
	}
	return ba
}

func (acc *UserAccount) PubkeyHashToByteArray() ByteArray {
	ba, err := HexToByteArray(acc.PublicKeyHash)
	if err != nil {
		panic(err)
	}
	return ba
}

func (acc *UserAccount) IsCoordinator() bool {
	if acc.Path != "" {
		return false
	}

	if acc.Status != 1 {
		return false
	}

	if acc.Type != 0 {
		return false
	}

	return true
}

func (acc *UserAccount) AccountInclusionProof(path int64) rollup.TypesAccountInclusionProof {
	return rollup.TypesAccountInclusionProof{
		PathToAccount: big.NewInt(path),
		Account:       acc.ToABIAccount(),
	}
}

func (acc *UserAccount) ABIEncode() ([]byte, error) {
	uint256Ty, err := abi.NewType("uint256", "uint256", nil)
	if err != nil {
		return []byte(""), err
	}

	arguments := abi.Arguments{
		{
			Type: uint256Ty,
		},
		{
			Type: uint256Ty,
		},
		{
			Type: uint256Ty,
		},
		{
			Type: uint256Ty,
		},
	}
	bytes, err := arguments.Pack(
		big.NewInt(int64(acc.AccountID)),
		big.NewInt(int64(acc.Balance)),
		big.NewInt(int64(acc.Nonce)),
		big.NewInt(int64(acc.TokenType)),
	)
	if err != nil {
		return []byte(""), err
	}

	return bytes, nil
}

func (acc *UserAccount) CreateAccountHash() {
	data, err := acc.ABIEncode()
	if err != nil {
		return
	}
	accountHash := common.Keccak256(data)
	acc.Hash = accountHash.String()
}

//
// Utils
//

// EmptyAcccount creates a new account which has the same hash as ZERO_VALUE_LEAF
func EmptyAccount() UserAccount {
	return *NewUserAccount(ZERO, ZERO, ZERO, ZERO, STATUS_ACTIVE, "", "")
}

//
// DB interactions for account
//

// InitBalancesTree initialises the balances tree
func (db *DB) InitBalancesTree(depth uint64, genesisAccounts []UserAccount) error {
	// calculate total number of leaves
	totalLeaves := math.Exp2(float64(depth))
	if int(totalLeaves) != len(genesisAccounts) {
		return errors.New("Depth and number of leaves do not match")
	}
	db.Logger.Debug("Attempting to init balance tree", "totalAccounts", totalLeaves)

	var err error

	// insert coodinator leaf
	err = db.InsertCoordinatorAccount(&genesisAccounts[0], depth)
	if err != nil {
		db.Logger.Error("Unable to insert coodinator account", "err", err)
		return err
	}

	var insertRecords []interface{}
	prevNodePath := genesisAccounts[0].Path

	for i := 1; i < len(genesisAccounts); i++ {
		pathToAdjacentNode, err := GetAdjacentNodePath(prevNodePath)
		if err != nil {
			return err
		}
		genesisAccounts[i].UpdatePath(pathToAdjacentNode)
		insertRecords = append(insertRecords, genesisAccounts[i])
		prevNodePath = genesisAccounts[i].Path
	}

	db.Logger.Info("Inserting all accounts to DB", "count", len(insertRecords))
	err = gormbulk.BulkInsert(db.Instance, insertRecords, len(insertRecords))
	if err != nil {
		db.Logger.Error("Unable to insert accounts to DB", "err", err)
		return errors.New("Unable to insert accounts")
	}

	// merkelise
	// 1. Pick all leaves at level depth
	// 2. Iterate 2 of them and create parents and store
	// 3. Persist all parents to database
	// 4. Start with next round
	for i := depth; i > 0; i-- {
		// get all leaves at depth N
		accs, err := db.GetAccountsAtDepth(i)
		if err != nil {
			return err
		}
		var nextLevelAccounts []interface{}

		// iterate over 2 at a time and create next level
		for i := 0; i < len(accs); i += 2 {
			left, err := HexToByteArray(accs[i].Hash)
			if err != nil {
				return err
			}
			right, err := HexToByteArray(accs[i+1].Hash)
			if err != nil {
				return err
			}
			parentHash, err := GetParent(left, right)
			if err != nil {
				return err
			}
			left, err = HexToByteArray(accs[i].PublicKeyHash)
			if err != nil {
				return err
			}
			right, err = HexToByteArray(accs[i+1].PublicKeyHash)
			if err != nil {
				return err
			}
			parentPubkeyHash, err := GetParent(left, right)
			if err != nil {
				return err
			}
			parentPath := GetParentPath(accs[i].Path)
			newAccNode := *NewAccountNode(parentPath, parentHash.String(), parentPubkeyHash.String())
			nextLevelAccounts = append(nextLevelAccounts, newAccNode)
		}

		err = gormbulk.BulkInsert(db.Instance, nextLevelAccounts, len(nextLevelAccounts))
		if err != nil {
			db.Logger.Error("Unable to insert accounts to DB", "err", err)
			return errors.New("Unable to insert accounts")
		}
	}

	// mark the root node type correctly
	return nil
}

func (db *DB) GetAccountsAtDepth(depth uint64) ([]UserAccount, error) {
	var accs []UserAccount
	err := db.Instance.Where("level = ?", depth).Find(&accs).Error
	if err != nil {
		return accs, err
	}
	return accs, nil
}

func (db *DB) UpdateAccount(account UserAccount) error {
	// update the pubkey hash of the account
	bz, err := ABIEncodePubkey(account.PublicKey)
	if err != nil {
		return err
	}
	account.PublicKeyHash = common.Keccak256(bz).String()
	db.Logger.Info("Updated account pubkey", "ID", account.AccountID, "PubkeyHash", account.PublicKeyHash)
	account.CreateAccountHash()
	siblings, err := db.GetSiblings(account.Path)
	if err != nil {
		return err
	}

	db.Logger.Debug("Updating account", "Hash", account.Hash, "Path", account.Path, "siblings", siblings, "countOfSiblings", len(siblings))

	return db.StoreLeaf(account, account.Path, siblings)
}

func (db *DB) StoreLeaf(account UserAccount, path string, siblings []UserAccount) error {
	var err error
	computedNode := account
	for i := 0; i < len(siblings); i++ {
		var parentHash ByteArray
		var parentPubkeyHash ByteArray
		sibling := siblings[i]
		isComputedRightSibling := GetNthBitFromRight(
			path,
			i,
		)
		if isComputedRightSibling == 0 {
			parentHash, err = GetParent(computedNode.HashToByteArray(), sibling.HashToByteArray())
			if err != nil {
				return err
			}
			parentPubkeyHash, err = GetParent(computedNode.PubkeyHashToByteArray(), sibling.PubkeyHashToByteArray())
			if err != nil {
				return err
			}

			// Store the node!
			err = db.StoreNode(parentHash, parentPubkeyHash, computedNode, sibling)
			if err != nil {
				return err
			}
		} else {
			parentHash, err = GetParent(sibling.HashToByteArray(), computedNode.HashToByteArray())
			if err != nil {
				return err
			}
			parentPubkeyHash, err = GetParent(sibling.PubkeyHashToByteArray(), computedNode.PubkeyHashToByteArray())
			if err != nil {
				return err
			}
			// Store the node!
			err = db.StoreNode(parentHash, parentPubkeyHash, sibling, computedNode)
			if err != nil {
				return err
			}
		}

		parentAccount, err := db.GetAccountByPath(GetParentPath(computedNode.Path))
		if err != nil {
			return err
		}
		computedNode = parentAccount
	}

	// Store the new root
	err = db.UpdateRootNodeHashes(computedNode.HashToByteArray(), computedNode.PubkeyHashToByteArray())
	if err != nil {
		return err
	}

	return nil
}

// StoreNode updates the nodes given the parent hash
func (db *DB) StoreNode(parentHash, parentPubkeyHash ByteArray, leftNode UserAccount, rightNode UserAccount) (err error) {
	// update left account
	err = db.updateAccount(leftNode, leftNode.Path)
	if err != nil {
		return err
	}
	// update right account
	err = db.updateAccount(rightNode, rightNode.Path)
	if err != nil {
		return err
	}
	// update the parent with the new hashes
	return db.UpdateParentWithHash(GetParentPath(leftNode.Path), parentHash, parentPubkeyHash)
}

func (db *DB) UpdateParentWithHash(pathToParent string, newHash, newPubkeyHash ByteArray) error {
	// Update the root hash
	var tempAccount UserAccount
	tempAccount.Path = pathToParent
	tempAccount.Hash = newHash.String()
	tempAccount.PublicKeyHash = newPubkeyHash.String()
	return db.updateAccount(tempAccount, pathToParent)
}

func (db *DB) UpdateRootNodeHashes(newRoot ByteArray, newPubkeyHash ByteArray) error {
	var tempAccount UserAccount
	tempAccount.Path = ""
	tempAccount.Hash = newRoot.String()
	tempAccount.PublicKeyHash = newPubkeyHash.String()
	return db.updateAccount(tempAccount, tempAccount.Path)
}

func (db *DB) AddNewPendingAccount(acc UserAccount) error {
	return db.Instance.Create(&acc).Error
}

func (db *DB) GetSiblings(path string) ([]UserAccount, error) {
	var relativePath = path
	var siblings []UserAccount
	for i := len(path); i > 0; i-- {
		otherChild := GetOtherChild(relativePath)
		otherNode, err := db.GetAccountByPath(otherChild)
		if err != nil {
			return siblings, err
		}
		siblings = append(siblings, otherNode)
		relativePath = GetParentPath(relativePath)
	}
	return siblings, nil
}

// GetAccount gets the account of the given path from the DB
func (db *DB) GetAccountByPath(path string) (UserAccount, error) {
	var account UserAccount
	err := db.Instance.Where("path = ?", path).Find(&account).GetErrors()
	if len(err) != 0 {
		return account, ErrRecordNotFound(fmt.Sprintf("unable to find record for path: %v err:%v", path, err))
	}
	return account, nil
}

func (db *DB) GetAccountByHash(hash string) (UserAccount, error) {
	var account UserAccount
	if db.Instance.First(&account, hash).RecordNotFound() {
		return account, ErrRecordNotFound(fmt.Sprintf("unable to find record for hash: %v", hash))
	}
	return account, nil
}

func (db *DB) GetAccountByID(ID uint64) (UserAccount, error) {
	var account UserAccount
	if err := db.Instance.Where("account_id = ? AND status = ?", ID, STATUS_ACTIVE).Find(&account).Error; err != nil {
		return account, ErrRecordNotFound(fmt.Sprintf("unable to find record for ID: %v", ID))
	}
	return account, nil
}
func (db *DB) GetDepositSubTreeRoot(hash string, level uint64) (UserAccount, error) {
	var account UserAccount
	err := db.Instance.Where("level = ? AND hash = ?", level, hash).First(&account).Error
	if gorm.IsRecordNotFoundError(err) {
		return account, ErrRecordNotFound(fmt.Sprintf("unable to find record for hash: %v", hash))
	}
	return account, nil
}

func (db *DB) GetRoot() (UserAccount, error) {
	var account UserAccount
	err := db.Instance.Where("level = ?", 0).Find(&account).GetErrors()
	if len(err) != 0 {
		return account, ErrRecordNotFound(fmt.Sprintf("unable to find record. err:%v", err))
	}
	return account, nil
}

func (db *DB) InsertCoordinatorAccount(acc *UserAccount, depth uint64) error {
	acc.UpdatePath(GenCoordinatorPath(depth))
	acc.CreateAccountHash()
	acc.Type = 1
	return db.Instance.Create(&acc).Error
}

// updateAccount will simply replace all the changed fields
func (db *DB) updateAccount(newAcc UserAccount, path string) error {
	return db.Instance.Model(&newAcc).Where("path = ?", path).Update(newAcc).Error
}

func (db *DB) GetAccountCount() (int, error) {
	var count int
	db.Instance.Table("user_accounts").Count(&count)
	return count, nil
}

func (db *DB) DeletePendingAccount(ID uint64) error {
	var account UserAccount
	if err := db.Instance.Where("account_id = ? AND status = ?", ID, STATUS_PENDING).Delete(&account).Error; err != nil {
		return ErrRecordNotFound(fmt.Sprintf("unable to delete record for ID: %v", ID))
	}
	return nil
}

//
// Pubkey related interactions
//
func ABIEncodePubkey(pubkey string) ([]byte, error) {
	pubkeyBytes, err := hex.DecodeString(pubkey)
	if err != nil {
		panic(err)
	}
	uint256Ty, err := abi.NewType("bytes", "bytes", nil)
	if err != nil {
		return []byte(""), err
	}

	arguments := abi.Arguments{
		{
			Type: uint256Ty,
		},
	}

	bytes, err := arguments.Pack(
		pubkeyBytes,
	)

	if err != nil {
		return []byte(""), err
	}

	return bytes, nil
}

//
// Account changes post transaction processing
//

func (db *DB) TransactionProcessing(account *UserAccount, newBalance uint64) error {
	return nil
}
