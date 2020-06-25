package listener

import (
	"encoding/hex"
	"fmt"
	"math/big"

	"github.com/BOPR/common"
	"github.com/BOPR/core"
	"github.com/ethereum/go-ethereum/accounts/abi"
	ethTypes "github.com/ethereum/go-ethereum/core/types"

	"github.com/BOPR/contracts/logger"
)

func (s *Syncer) processDepositQueued(eventName string, abiObject *abi.ABI, vLog *ethTypes.Log) {
	s.Logger.Info("New deposit found")

	// unpack event
	event := new(logger.LoggerDepositQueued)

	err := common.UnpackLog(abiObject, event, eventName, vLog)
	if err != nil {
		// TODO do something with this error
		fmt.Println("Unable to unpack log:", err)
		panic(err)
	}

	s.Logger.Info(
		"⬜ New event found",
		"event", eventName,
		"accountID", event.AccountID.String(),
		"Amount", event.Amount.String(),
		"TokenID", event.Token.String(),
		"AccountHash", event.AccountHash,
		"pubkey", event.Pubkey,
	)

	// add new account in pending state to DB and
	newAccount := core.NewPendingUserAccount(event.AccountID.Uint64(), event.Amount.Uint64(), event.Token.Uint64(), hex.EncodeToString(event.Pubkey))
	if err := s.DBInstance.AddNewPendingAccount(*newAccount); err != nil {
		panic(err)
	}
}

func (s *Syncer) processDepositLeafMerged(eventName string, abiObject *abi.ABI, vLog *ethTypes.Log) {
	s.Logger.Info("Deposit Leaf merged")
	// unpack event
	event := new(logger.LoggerDepositLeafMerged)

	err := common.UnpackLog(abiObject, event, eventName, vLog)
	if err != nil {
		// TODO do something with this error
		fmt.Println("Unable to unpack log:", err)
		panic(err)
	}

	leftLeaf := core.ByteArray(event.Left)
	rightLeaf := core.ByteArray(event.Right)
	newRoot := core.ByteArray(event.NewRoot)

	s.Logger.Info(
		"⬜ New event found",
		"event", eventName,
		"prevDepositRoot", leftLeaf.String(),
		"incomingLeaf", rightLeaf.String(),
		"newDepositRoot", newRoot.String(),
	)

	// update deposit sub tree root
	newheight, err := s.DBInstance.OnDepositLeafMerge(leftLeaf, rightLeaf, newRoot)
	if err != nil {
		panic(err)
	}
	params, err := s.DBInstance.GetParams()
	if err != nil {
		panic(err)
	}

	// if deposit subtree height = deposit finalisation height then
	if newheight == params.MaxDepositSubTreeHeight {
		// send deposit finalisation transction to ethereum chain
		s.SendDepositFinalisationTx()
	}
}

func (s *Syncer) processDepositFinalised(eventName string, abiObject *abi.ABI, vLog *ethTypes.Log) {
	s.Logger.Info("Deposits finalised")

	// unpack event
	event := new(logger.LoggerDepositsFinalised)

	err := common.UnpackLog(abiObject, event, eventName, vLog)
	if err != nil {
		// TODO do something with this error
		fmt.Println("Unable to unpack log:", err)
		panic(err)
	}
	accountsRoot := core.ByteArray(event.DepositSubTreeRoot)
	pathToDepositSubTree := event.PathToSubTree

	s.Logger.Info(
		"⬜ New event found",
		"event", eventName,
		"DepositSubTreeRoot", accountsRoot.String(),
		"PathToDepositSubTreeInserted", pathToDepositSubTree.String(),
	)

	// TODO handle error
	newRoot, err := s.DBInstance.FinaliseDepositsAndAddBatch(accountsRoot, pathToDepositSubTree.Uint64())
	if err != nil {
		fmt.Println("Error while finalising deposits", err)
	}
	fmt.Println("new root", newRoot)
}

func (s *Syncer) processNewBatch(eventName string, abiObject *abi.ABI, vLog *ethTypes.Log) {
	s.Logger.Info("New batch submitted on eth chain")

	event := new(logger.LoggerNewBatch)

	err := common.UnpackLog(abiObject, event, eventName, vLog)
	if err != nil {
		// TODO do something with this error
		fmt.Println("Unable to unpack log:", err)
		panic(err)
	}
	s.Logger.Info(
		"⬜ New event found",
		"event", eventName,
		"BatchNumber", event.Index.String(),
		"TxRoot", core.ByteArray(event.Txroot).String(),
		"NewStateRoot", core.ByteArray(event.UpdatedRoot).String(),
		"Committer", event.Committer.String(),
	)
	params, err := s.DBInstance.GetParams()
	if err != nil {
		return
	}
	var txs [][]byte
	var stakeAmount uint64

	if event.Index.Uint64() == 0 {
		stakeAmount = 0
	} else if "0x0000000000000000000000000000000000000000000000000000000000000000" == core.ByteArray(event.Txroot).String() {
		stakeAmount = params.StakeAmount
	} else {
		// pick the calldata for the batch
		txHash := vLog.TxHash
		txs, err = s.loadedBazooka.FetchBatchInputData(txHash)
		if err != nil {
			// TODO do something with this error
			panic(err)
		}
		stakeAmount = params.StakeAmount
	}

	// TODO run the transactions through ProcessTx present on-chain
	// if any tx is fraud, challenge


	// TODO apply transactions and match state root

	
	// create a new batch
	newBatch := core.Batch{
		Index:                event.Index.Uint64(),
		StateRoot:            core.ByteArray(event.UpdatedRoot),
		TxRoot:               core.ByteArray(event.Txroot),
		TransactionsIncluded: txs,
		Committer:            event.Committer.String(),
		StakeAmount:          stakeAmount,
		FinalisesOn:          *big.NewInt(100),
	}

	err = s.DBInstance.AddNewBatch(newBatch)
	if err != nil {
		// TODO do something with this error
		panic(err)
	}
}
func (s *Syncer) processRegisteredToken(eventName string, abiObject *abi.ABI, vLog *ethTypes.Log) {
	s.Logger.Info("New token registered")
	event := new(logger.LoggerRegisteredToken)

	err := common.UnpackLog(abiObject, event, eventName, vLog)
	if err != nil {
		// TODO do something with this error
		fmt.Println("Unable to unpack log:", err)
		panic(err)
	}
	s.Logger.Info(
		"⬜ New event found",
		"event", eventName,
		"TokenAddress", event.TokenContract.String(),
		"TokenID", event.TokenType,
	)
	newToken := core.Token{TokenID: event.TokenType.Uint64(), Address: event.TokenContract.String()}
	if err := s.DBInstance.AddToken(newToken); err != nil {
		panic(err)
	}
}

func (s *Syncer) SendDepositFinalisationTx() {
	params, err := s.DBInstance.GetParams()
	if err != nil {
		return
	}
	nodeToBeReplaced, siblings, err := s.DBInstance.GetDepositNodeAndSiblings()
	if err != nil {
		return
	}

	err = s.loadedBazooka.FireDepositFinalisation(nodeToBeReplaced, siblings, params.MaxDepositSubTreeHeight)
}
