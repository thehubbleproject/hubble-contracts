package bazooka

import (
	big "math/big"

	"github.com/BOPR/common"
	"github.com/BOPR/config"
	"github.com/BOPR/contracts/rollup"
	"github.com/BOPR/core"
	"github.com/ethereum/go-ethereum"
	ethCmn "github.com/ethereum/go-ethereum/common"
)

func (b *Bazooka) FireDepositFinalisation(TBreplaced core.UserAccount, siblings []core.UserAccount, subTreeHeight uint64) error {
	b.log.Info(
		"Attempting to finalise deposits",
		"NodeToBeReplaced",
		TBreplaced.String(),
		"NumberOfSiblings",
		len(siblings),
		"atDepth",
		subTreeHeight,
	)

	// TODO check latest batch on-chain and if we need to push new batch

	depositSubTreeHeight := big.NewInt(0)
	depositSubTreeHeight.SetUint64(subTreeHeight)
	var siblingData [][32]byte
	for _, sibling := range siblings {
		data, err := core.HexToByteArray(sibling.Hash)
		if err != nil {
			return err
		}
		siblingData = append(siblingData, data)
	}
	accountProof := rollup.TypesAccountMerkleProof{}
	accountProof.AccountIP.PathToAccount = core.StringToBigInt(TBreplaced.Path)
	accountProof.AccountIP.Account = TBreplaced.ToABIAccount()
	accountProof.Siblings = siblingData
	data, err := b.ContractABI[common.ROLLUP_CONTRACT_KEY].Pack("finaliseDepositsAndSubmitBatch", depositSubTreeHeight, accountProof)
	if err != nil {
		return err
	}

	rollupAddress := ethCmn.HexToAddress(config.GlobalCfg.RollupAddress)
	stakeAmount := big.NewInt(0)
	stakeAmount.SetString("32000000000000000000", 10)

	// generate call msg
	callMsg := ethereum.CallMsg{
		To:    &rollupAddress,
		Data:  data,
		Value: stakeAmount,
	}

	auth, err := b.GenerateAuthObj(b.EthClient, callMsg)
	if err != nil {
		return err
	}
	b.log.Info("Broadcasting deposit finalisation transaction")
	tx, err := b.RollupContract.FinaliseDepositsAndSubmitBatch(auth, depositSubTreeHeight, accountProof)
	if err != nil {
		return err
	}
	b.log.Info("Deposits successfully finalized!", "TxHash", tx.Hash())
	return nil
}

// SubmitBatch submits the batch on chain with updated root and compressed transactions
func (b *Bazooka) SubmitBatch(updatedRoot core.ByteArray, txs []core.Tx) error {
	b.log.Info(
		"Attempting to submit a new batch",
		"UpdatedRoot",
		updatedRoot.String(),
		"txs",
		len(txs),
	)

	var compressedTxs [][]byte
	for _, tx := range txs {
		compressedTx, err := tx.Compress()
		if err != nil {
			return err
		}
		compressedTxs = append(compressedTxs, compressedTx)
	}

	data, err := b.ContractABI[common.ROLLUP_CONTRACT_KEY].Pack("submitBatch", compressedTxs, updatedRoot)
	if err != nil {
		return err
	}

	rollupAddress := ethCmn.HexToAddress(config.GlobalCfg.RollupAddress)

	// generate call msg
	callMsg := ethereum.CallMsg{
		To:   &rollupAddress,
		Data: data,
	}

	auth, err := b.GenerateAuthObj(b.EthClient, callMsg)
	if err != nil {
		return err
	}

	tx, err := b.RollupContract.SubmitBatch(auth, compressedTxs, updatedRoot)
	if err != nil {
		return err
	}
	b.log.Info("Sent a new batch!", "txHash",tx.Hash().String())
	return nil
}
