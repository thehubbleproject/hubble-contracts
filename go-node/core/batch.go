package core

import (
	"fmt"
	"math/big"

	"encoding/json"
)

// Batch is the batches that need to be submitted on-chain periodically
type Batch struct {
	Index                uint64
	StateRoot            ByteArray
	Committer            string
	TxRoot               ByteArray
	StakeAmount          uint64
	FinalisesOn          big.Int
	SubmissionHash       string
	TransactionsIncluded [][]byte
}

func (b *Batch) DBModel() (BatchModel, error) {
	encodedTxs, err := json.Marshal(b.TransactionsIncluded)
	if err != nil {
		return BatchModel{}, err
	}
	encodedStateRoot, err := json.Marshal(b.StateRoot)
	if err != nil {
		return BatchModel{}, err
	}
	encodedTxRoot, err := json.Marshal(b.TxRoot)
	if err != nil {
		return BatchModel{}, err
	}
	finalisationBlockBytes := b.FinalisesOn.Bytes()
	newBatchModel := BatchModel{
		Index:                b.Index,
		StateRoot:            encodedStateRoot,
		Committer:            b.Committer,
		TxRoot:               encodedTxRoot,
		StakeAmount:          b.StakeAmount,
		FinalisesOn:          finalisationBlockBytes,
		SubmissionHash:       b.SubmissionHash,
		TransactionsIncluded: encodedTxs,
	}
	return newBatchModel, nil
}

// BatchModel represents the actual stuff stored in the DB
// We are encoding the whole struct because we will save some operations
// if we can just read the model for data in some cases and only decode when we need the encoded data
type BatchModel struct {
	Index                uint64
	StateRoot            []byte
	Committer            string
	TxRoot               []byte
	StakeAmount          uint64
	FinalisesOn          []byte
	SubmissionHash       string
	TransactionsIncluded []byte `gorm:"size:10000"`
}

func (b *BatchModel) Batch() (Batch, error) {
	var decodedTxs [][]byte
	err := json.Unmarshal(b.TransactionsIncluded, &decodedTxs)
	if err != nil {
		return Batch{}, err
	}
	var decodedStateRoot ByteArray
	err = json.Unmarshal(b.StateRoot, &decodedStateRoot)
	if err != nil {
		return Batch{}, err
	}
	var decodedTxRoot ByteArray
	err = json.Unmarshal(b.TxRoot, &decodedTxRoot)
	if err != nil {
		return Batch{}, err
	}
	finalisationBlockBN := big.NewInt(0)
	finalisationBlockBN.SetBytes(b.FinalisesOn)
	newBatch := Batch{
		Index:                b.Index,
		StateRoot:            decodedStateRoot,
		Committer:            b.Committer,
		TxRoot:               decodedTxRoot,
		StakeAmount:          b.StakeAmount,
		FinalisesOn:          *finalisationBlockBN,
		SubmissionHash:       b.SubmissionHash,
		TransactionsIncluded: decodedTxs,
	}
	return newBatch, nil
}

func (db *DB) GetAllBatches() (batches []Batch, err error) {
	errs := db.Instance.Find(&batches).GetErrors()
	for _, err := range errs {
		if err != nil {
			return batches, GenericError("got error while fetch all batches")
		}
	}
	return
}

func (db *DB) GetLatestBatch() (batch Batch, err error) {
	if err := db.Instance.First(&batch).Error; err != nil {
		return batch, ErrRecordNotFound(fmt.Sprintf("unable to find latest batch"))
	}
	return batch, nil
}

func (db *DB) GetBatchCount() (int, error) {
	var count int
	db.Instance.Table("batches").Count(&count)
	return count, nil
}

func (db *DB) AddNewBatch(batch Batch) error {
	batchModel, err := batch.DBModel()
	if err != nil {
		return err
	}
	return db.Instance.Create(batchModel).Error
}
