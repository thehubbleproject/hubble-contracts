package core

import (
	"errors"
	"fmt"
	"math/big"

	"encoding/hex"
	
	"github.com/BOPR/common"
	"github.com/BOPR/config"
	"github.com/BOPR/contracts/rollup"
	"github.com/ethereum/go-ethereum/accounts/abi"
	ethCmn "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/rlp"
	"golang.org/x/crypto/sha3"
)

// Tx represets the transaction on BOPRU
type Tx struct {
	DBModel
	To        uint64 `json:"to"`
	From      uint64 `json:"from"`
	Amount    uint64 `json:"amount"`
	Nonce     uint64 `json:"nonce"`
	TokenID   uint64 `json:"tokenID"`
	Signature string `json:"sig" gorm:"not null"`
	TxHash    string `json:"hash" gorm:"not null"`

	// 100 Pending
	// 200 Processing
	// 300 Processed
	// 400 reverted
	Status uint `json:"status"`
}

// NewTx creates a new transaction
func NewTx(to uint64, from uint64, amount uint64, nonce uint64, sig string, tokenID uint64) Tx {
	return Tx{
		To:        to,
		From:      from,
		Amount:    amount,
		Nonce:     nonce,
		TokenID:   tokenID,
		Signature: sig,
	}
}

// GetSignBytes returns the transaction data that has to be signed
func (tx Tx) GetSignBytes() (signBytes []byte, err error) {
	data, err := tx.Bytes()
	if err != nil {
		return signBytes, err
	}
	return common.Keccak256(data).Bytes(), nil
}

// Bytes just contains the tx apart from the bytes
func (tx *Tx) Bytes() ([]byte, error) {
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
		big.NewInt(int64(tx.From)),
		big.NewInt(int64(tx.To)),
		big.NewInt(int64(tx.TokenID)),
		big.NewInt(int64(tx.Amount)),
	)

	if err != nil {
		return []byte(""), err
	}

	return bytes, nil
}

// AssignHash creates a tx hash and add it to the tx
func (t *Tx) AssignHash() {
	if t.TxHash != "" {
		return
	}
	hash := rlpHash(t)
	t.TxHash = hash.String()
}

// NewPendingTx creates a new transaction
func NewPendingTx(to uint64, from uint64, amount uint64, nonce uint64, sig string, tokenID uint64) Tx {
	return Tx{
		To:        to,
		From:      from,
		Amount:    amount,
		Nonce:     nonce,
		TokenID:   tokenID,
		Signature: sig,
		Status:    TX_STATUS_PENDING,
	}
}

// ValidateTx validates a transaction
// NOTE: This is a stateless op, should be run before adding txs to mempool
func (t *Tx) ValidateBasic() error {
	// check status is within the permissible status codes
	if t.Status < TX_STATUS_PENDING {
		return errors.New("Invalid status code for the transaction found")
	}

	// check amount is greater than 0
	if t.Amount == 0 {
		return errors.New("Invalid amount. Cannot be less than 0")
	}

	// Check nonce is greater than 0
	if t.Nonce < 0 {
		return errors.New("Invalid nonce for the transaction found. Cannot be less than 0")
	}

	// check the ID's are greater than 0
	if t.From == 0 {
		return errors.New("Invalid from address found. From cannot be 0")
	}

	// check the ID's are greater than 0
	if t.From < 0 || t.To < 0 {
		return errors.New("Invalid To or From found. Cannot be less than 0")
	}

	return nil
}

func (t *Tx) String() string {
	return fmt.Sprintf("To: %v From: %v Amount: %v Nonce: %v Type:%v Status:%v Hash: %v", t.To, t.From, t.Amount, t.Nonce, t.TokenID, t.Status, t.TxHash)
}

// ToABIVersion converts a standard tx to the the DataTypesTransaction struct on the contract
func (t *Tx) ToABIVersion(from, to int64) rollup.TypesTransaction {
	decodedSignature, _ := hex.DecodeString(t.Signature)
	return rollup.TypesTransaction{
		ToIndex:   big.NewInt(to),
		FromIndex: big.NewInt(from),
		Amount:    uint32(t.Amount),
		TokenType: big.NewInt(int64(t.TokenID)),
		Signature: decodedSignature,
	}
}

func (tx *Tx) Compress() ([]byte, error) {
	uint256Ty, err := abi.NewType("uint256", "uint256", nil)
	if err != nil {
		return []byte(""), err
	}

	bytesTy, err := abi.NewType("bytes", "bytes", nil)
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
		{
			Type: bytesTy,
		},
	}

	bytes, err := arguments.Pack(
		big.NewInt(int64(tx.From)),
		big.NewInt(int64(tx.To)),
		big.NewInt(int64(tx.TokenID)),
		big.NewInt(int64(tx.Amount)),
		[]byte(tx.Signature),
	)

	if err != nil {
		return []byte(""), err
	}

	return bytes, nil
}

// Insert tx into the DB
func (db *DB) InsertTx(t *Tx) error {
	return db.Instance.Create(t).Error
}

func (db *DB) PopTxs() (txs []Tx, err error) {
	tx := db.Instance.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Error; err != nil {
		return txs, err
	}
	var pendingTxs []Tx

	// select N number of transactions which are pending in mempool and
	if err := tx.Limit(config.GlobalCfg.TxsPerBatch).Where(&Tx{Status: 100}).Find(&pendingTxs).Error; err != nil {
		db.Logger.Error("error while fetching pending transactions", err)
		return txs, err
	}

	db.Logger.Info("found txs", "pendingTxs", pendingTxs)

	var ids []string
	for _, tx := range pendingTxs {
		ids = append(ids, tx.ID)
	}

	// update the transactions from pending to processing
	errs := tx.Table("txes").Where("id IN (?)", ids).Updates(map[string]interface{}{"status": 200}).GetErrors()
	if err != nil {
		db.Logger.Error("errors while processing transactions", errs)
		return
	}

	return pendingTxs, tx.Commit().Error
}

func (db *DB) GetTx() (tx []Tx, err error) {
	err = db.Instance.First(&tx).Error
	if err != nil {
		return tx, err
	}
	return
}

// GetTxVerificationData fetches all the data required to prove validity fo transaction
func (db *DB) GetTxVerificationData(tx Tx) (fromMerkleProof, toMerkleProof AccountMerkleProof, PDAProof PDAMerkleProof, err error) {
	fromAcc, err := db.GetAccountByID(tx.From)
	if err != nil {
		return
	}
	fmt.Println("got from account", fromAcc.String())
	fromSiblings, err := db.GetSiblings(fromAcc.Path)
	if err != nil {
		return
	}
	fmt.Println("got siblings", fromAcc.String())
	fromMerkleProof = NewAccountMerkleProof(fromAcc, fromSiblings)
	toAcc, err := db.GetAccountByID(tx.To)
	if err != nil {
		return
	}
	fmt.Println("got to account", toAcc.String())
	var toSiblings []UserAccount
	mysqlTx := db.Instance.Begin()
	defer func() {
		if r := recover(); r != nil {
			mysqlTx.Rollback()
		}
	}()
	dbCopy,_ := NewDB() 
	dbCopy.Instance = mysqlTx
	// STATE UPDATES TO BE REMOVED
	fromAcc.Balance -= tx.Amount
	fmt.Println("updated from account bal",fromAcc.Balance)
	err=dbCopy.UpdateAccount(fromAcc)	
	if err!=nil{
		return	
	}
	toSiblings, err = dbCopy.GetSiblings(toAcc.Path)
	if err != nil {
		return
	}
	fmt.Println("got siblings", toSiblings)
	mysqlTx.Rollback()
	toMerkleProof = NewAccountMerkleProof(toAcc, toSiblings)
	PDAProof = NewPDAProof(fromAcc.Path, fromAcc.PublicKey, fromSiblings)
	return fromMerkleProof, toMerkleProof, PDAProof, nil
}

func rlpHash(x interface{}) (h ethCmn.Hash) {
	hw := sha3.NewLegacyKeccak256()
	rlp.Encode(hw, x)
	hw.Sum(h[:0])
	return h
}
