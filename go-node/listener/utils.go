package listener

import (
	"bytes"

	"github.com/ethereum/go-ethereum/accounts/abi"
)

// EventByID searches for all the loaded ABI's for matching events
func EventByID(abiObject *abi.ABI, sigdata []byte) *abi.Event {
	for _, event := range abiObject.Events {
		if bytes.Equal(event.ID().Bytes(), sigdata) {
			return &event
		}
	}
	return nil
}
