package core

import "math/big"

// Params stores all the parameters which are maintained on-chain and keeps updating
// them whenever they change on-chain
type Params struct {
	DBModel

	// Stake amount which coordinator needs to submit a new batch
	// Updates when syncer receives a stake update event from the contract
	// Used while sending new batch
	StakeAmount uint64 `json:"stakeAmount"`

	// MaxDepth is the maximum depth of the balances tree possible
	// If in case we want to increase it we will update the value on the contract
	// And then this will be updated
	MaxDepth uint64 `json:"maxDepth"`

	// DepositSubTreeHeight is the maximum height of the deposit subtree that the coordinator wants to merge
	// It is set on the contract and will be updated when that value changes
	MaxDepositSubTreeHeight uint64 `json:"maxDepositSubTreeHeight"`
}

// Maintains sync information
type SyncStatus struct {
	DBModel
	// Last eth block seen by the syncer is persisted here so that we can resume sync from it
	LastEthBlockRecorded uint64 `json:"lastEthBlockRecorded"`

	// Last batch index is recorded for this field
	LastBatchRecorded uint64 `json:"lastBatchRecorded"`
}

func (ss *SyncStatus) LastEthBlockBigInt() *big.Int {
	n := new(big.Int)
	return n.SetUint64(ss.LastEthBlockRecorded)
}

func (db *DB) UpdateSyncStatusWithBatchNumber(batchIndex uint64) error {
	var updatedSyncStatus SyncStatus
	updatedSyncStatus.LastBatchRecorded = batchIndex
	if err := db.Instance.Table("sync_statuses").Assign(SyncStatus{LastBatchRecorded: batchIndex}).FirstOrCreate(&updatedSyncStatus).Error; err != nil {
		return err
	}
	return nil
}
func (db *DB) UpdateSyncStatusWithBlockNumber(blkNum uint64) error {
	var updatedSyncStatus SyncStatus
	updatedSyncStatus.LastEthBlockRecorded = blkNum
	if err := db.Instance.Table("sync_statuses").Assign(SyncStatus{LastEthBlockRecorded: blkNum}).FirstOrCreate(&updatedSyncStatus).Error; err != nil {
		return err
	}
	return nil
}

func (db *DB) GetSyncStatus() (status SyncStatus, err error) {
	if err := db.Instance.First(&status).Error; err != nil {
		return status, err
	}
	return status, nil
}

// UpdateStakeAmount updates the stake amount
func (db *DB) UpdateStakeAmount(newStakeAmount uint64) error {
	var updatedParams Params
	updatedParams.StakeAmount = newStakeAmount
	if err := db.Instance.Table("params").Assign(Params{StakeAmount: newStakeAmount}).FirstOrCreate(&updatedParams).Error; err != nil {
		return err
	}
	return nil
}

// UpdateMaxDepth updates the max depth
func (db *DB) UpdateMaxDepth(newDepth uint64) error {
	var updatedParams Params
	updatedParams.MaxDepth = newDepth
	if err := db.Instance.Table("params").Assign(Params{MaxDepth: newDepth}).FirstOrCreate(&updatedParams).Error; err != nil {
		return err
	}
	return nil
}

// UpdateDepositSubTreeHeight updates the max height of deposit sub tree
func (db *DB) UpdateDepositSubTreeHeight(newHeight uint64) error {
	var updatedParams Params
	updatedParams.MaxDepositSubTreeHeight = newHeight
	if err := db.Instance.Table("params").Assign(Params{MaxDepositSubTreeHeight: newHeight}).FirstOrCreate(&updatedParams).Error; err != nil {
		return err
	}
	return nil
}

// GetParams gets params from the DB
func (db *DB) GetParams() (params Params, err error) {
	if err := db.Instance.First(&params).Error; err != nil {
		return params, err
	}
	return params, nil
}
