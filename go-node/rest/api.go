package rest

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/BOPR/core"
)

type (
	// TxReceiver represents the tx received from user
	TxReceiver struct {
		From      uint64 `json:"from"`
		To        uint64 `json:"to"`
		Amount    uint64 `json:"amount"`
		Nonce     uint64 `json:"nonce"`
		TokenID   uint64 `json:"token"`
		Signature string `json:"sig"`
	}
)

func (tx *TxReceiver) Validate() error {
	if tx.Amount == 0 {
		return errors.New("amount in the transaction cannot be 0")
	}

	return nil
}

// TxReceiverHandler handles user txs
func TxReceiverHandler(w http.ResponseWriter, r *http.Request) {
	// receive the payload and read
	var tx TxReceiver
	if !ReadRESTReq(w, r, &tx) {
		WriteErrorResponse(w, http.StatusBadRequest, "Cannot read request")
	}

	if err := tx.Validate(); err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Bad input data for transation")
	}

	// create a new pending transaction
	userTx := core.NewPendingTx(tx.To, tx.From, tx.Amount, tx.Nonce, tx.Signature, tx.TokenID)

	// assign the transaction a HASH
	userTx.AssignHash()

	// do basic input validations
	err := userTx.ValidateBasic()
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Cannot read request")
	}

	// add the transaction to pool
	err = core.DBInstance.InsertTx(&userTx)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Cannot read request")
	}

	output, err := json.Marshal(userTx)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Unable to marshall account")
	}

	// write headers and data
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(output)
	return
}

// GetAccountHandler fetches the user account data like balance, token type and nonce
func GetAccountHandler(w http.ResponseWriter, r *http.Request) {
	vars := r.URL.Query()
	IDstr := vars.Get("ID")
	ID, err := strconv.ParseUint(IDstr, 0, 64)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Invalid ID")
	}
	fmt.Println(ID)
	var account core.UserAccount
	// account, err := core.DBInstance.GetAccount(ID)
	// if err != nil {
	// 	WriteErrorResponse(w, http.StatusBadRequest, fmt.Sprintf("Account with ID %v not found", ID))
	// }
	output, err := json.Marshal(account)
	if err != nil {
		WriteErrorResponse(w, http.StatusBadRequest, "Unable to marshall account")
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(output)
	return
}
