package core

import (
	"bytes"
	"errors"
	"fmt"
	"math"
)

type DepositTree struct {
	Height           uint64
	NumberOfDeposits uint64
	Root             string
}

func (t *DepositTree) String() string {
	return fmt.Sprintf("DepositTree: H:%v Count:%v Root:%v", t.Height, t.NumberOfDeposits, t.Root)
}

func (db *DB) InitEmptyDepositTree() error {
	var depositTree DepositTree
	depositTree.Root = ZERO_VALUE_LEAF.String()
	return db.Instance.Create(&depositTree).Error
}

func (db *DB) OnDepositLeafMerge(left, right, newRoot ByteArray) (uint64, error) {
	// get last deposit from deposit tree
	var lastDeposit DepositTree
	err := db.Instance.First(&lastDeposit).Error
	if err != nil {
		return 0, err
	}

	// update the deposit tree stored
	var updatedDepositTreeInfo DepositTree
	updatedDepositTreeInfo.Height = lastDeposit.Height + 1
	updatedDepositTreeInfo.NumberOfDeposits = lastDeposit.NumberOfDeposits + 2
	updatedDepositTreeInfo.Root = newRoot.String()

	if err := db.Instance.Model(&lastDeposit).Update(&updatedDepositTreeInfo).Error; err != nil {
		return 0, err
	}

	return updatedDepositTreeInfo.Height, nil
}

func (db *DB) GetDepositNodeAndSiblings() (NodeToBeReplaced UserAccount, siblings []UserAccount, err error) {
	// get params
	params, err := db.GetParams()
	if err != nil {
		return
	}

	// get the deposit node
	expectedHash := defaultHashes[params.MaxDepositSubTreeHeight]

	// getNode with the expectedHash
	NodeToBeReplaced, err = db.GetDepositSubTreeRoot(expectedHash.String(), params.MaxDepth-params.MaxDepositSubTreeHeight)
	if err != nil {
		return
	}

	// get siblings for the path to node
	siblings, err = db.GetSiblings(NodeToBeReplaced.Path)
	if err != nil {
		return
	}

	return
}

func (db *DB) FinaliseDepositsAndAddBatch(accountsRoot ByteArray, pathToDepositSubTree uint64) (string, error) {
	var root string
	db.Logger.Info("Finalising accounts", "accountRoot", accountsRoot, "pathToDepositSubTree", pathToDepositSubTree)

	// get params
	params, err := db.GetParams()
	if err != nil {
		return root, err
	}

	// number of new deposits = 2**MaxDepthOfDepositTree
	depositCount := uint64(math.Exp2(float64(params.MaxDepositSubTreeHeight)))

	// get all pending accounts
	pendingAccs, err := db.GetPendingDeposits(depositCount)
	if err != nil {
		return root, err
	}

	db.Logger.Debug("Fetched pending deposits", "count", len(pendingAccs), "data", pendingAccs)

	// update the empty leaves with new accounts
	err = db.FinaliseDeposits(pendingAccs, pathToDepositSubTree, params.MaxDepth)
	if err != nil {
		return root, err
	}

	rootAccount, err := db.GetRoot()
	if err != nil {
		return root, err
	}

	return rootAccount.Hash, nil
}

func (db *DB) FinaliseDeposits(pendingAccs []UserAccount, pathToDepositSubTree uint64, maxTreeDepth uint64) error {
	var accounts []UserAccount

	// fetch 2**DepositSubTree inactive accounts ordered by path
	err := db.Instance.Limit(len(pendingAccs)).Order("path").Where("status = ?", STATUS_NON_INITIALIZED).Find(&accounts).Error
	if err != nil {
		return err
	}
	height := maxTreeDepth - 1
	getTerminalNodesOf, err := SolidityPathToNodePath(pathToDepositSubTree, height)
	if err != nil {
		return err
	}
	// TODO add error for if no account found
	terminalNodes, err := db.GetAllTerminalNodes(getTerminalNodesOf)
	if err != nil {
		return err
	}

	for i, acc := range pendingAccs {
		acc.Status = STATUS_ACTIVE
		acc.UpdatePath(terminalNodes[i])
		acc.CreateAccountHash()
		err := db.UpdateAccount(acc)
		if err != nil {
			return err
		}

		// delete pending account
		err = db.DeletePendingAccount(acc.AccountID)
		if err != nil {
			return err
		}
	}

	return db.ResetDepositSubTree()
}

func (db *DB) GetPendingDeposits(numberOfAccs uint64) ([]UserAccount, error) {
	var accounts []UserAccount
	err := db.Instance.Limit(numberOfAccs).Where("status = ?", 0).Find(&accounts).Error
	if err != nil {
		return accounts, err
	}
	return accounts, nil
}

func (db *DB) GetAllTerminalNodes(pathToDepositSubTree string) (terminalNodes []string, err error) {
	buf := bytes.Buffer{}
	buf.WriteString(pathToDepositSubTree)
	buf.WriteString("%")

	var accounts []UserAccount

	// LIKE query with search for terminal nodes to DB
	if err = db.Instance.Where("path LIKE ? AND type = ?", buf.String(), 1).Find(&accounts).Error; err != nil {
		return
	}

	// get all accounts while making sure they are empty and append to paths array
	for _, account := range accounts {
		if account.Hash != ZERO_VALUE_LEAF.String() {
			return terminalNodes, errors.New("Account not zero, aborting operation")
		}
		terminalNodes = append(terminalNodes, account.Path)
	}
	return
}

func (db *DB) ResetDepositSubTree() error {
	var depositTree DepositTree
	if err := db.Instance.Delete(&depositTree).Error; err != nil {
		return err
	}

	return db.InitEmptyDepositTree()
}
