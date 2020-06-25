package main

import (
	"encoding/hex"
	"fmt"

	"github.com/BOPR/core"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

//  SendTransferTx generated init command to initialise the config file
func SendTransferTx() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "transfer",
		Short: "Transfers assets between 2 accounts",
		RunE: func(cmd *cobra.Command, args []string) error {
			toIndex := viper.GetUint64(FlagToAccountID)
			fromIndex := viper.GetUint64(FlagFromAccountID)
			tokenID := viper.GetUint64(FlagTokenID)
			privKey := viper.GetString(FlagPrivKey)
			amount := viper.GetUint64(FlagAmount)

			db, err := core.NewDB()
			if err != nil {
				return err
			}
			defer db.Close()

			fromAcc, err := db.GetAccountByID(fromIndex)
			if err != nil {
				return err
			}

			privKeyBytes, err := hex.DecodeString(privKey)
			if err != nil {
				return err
			}
			key := crypto.ToECDSAUnsafe(privKeyBytes)
			var txCore = core.Tx{
				From:    fromIndex,
				To:      toIndex,
				Amount:  1,
				TokenID: fromAcc.TokenType,
				Nonce:   fromAcc.Nonce + 1,
			}
			signBytes, err := txCore.GetSignBytes()
			if err != nil {
				return err
			}
			sig, err := crypto.Sign(signBytes, key)
			if err != nil {
				return err
			}

			tx := core.NewPendingTx(toIndex, fromIndex, amount, fromAcc.Nonce+1, hex.EncodeToString(sig), tokenID)
			tx.AssignHash()

			err = db.InsertTx(&tx)
			if err != nil {
				return err
			}
			fmt.Println("Transaction submitted successfully", "hash", tx.TxHash)
			return nil
		},
	}
	cmd.Flags().StringP(FlagToAccountID, "", "", "--to=<to-account>")
	cmd.Flags().StringP(FlagFromAccountID, "", "", "--from=<from-account>")
	cmd.Flags().StringP(FlagTokenID, "", "", "--token=<token-id>")
	cmd.Flags().StringP(FlagPrivKey, "", "", "--privkey=<privkey>")
	cmd.Flags().StringP(FlagAmount, "", "", "--amount=<amount>")
	cmd.MarkFlagRequired(FlagTokenID)
	return cmd
}

//  GetAccount generated init command to initialise the config file
func GetAccount() *cobra.Command {
	return &cobra.Command{
		Use:   "dummy-transfer",
		Short: "Transfers assets between 2 accounts",
		Run: func(cmd *cobra.Command, args []string) {

		},
	}
}
