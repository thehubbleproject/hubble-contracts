package common

import (
	"os"

	"github.com/tendermint/tendermint/libs/log"
)

// Global logger for bridge
var Logger log.Logger

func init() {
	Logger = log.NewTMLogger(log.NewSyncWriter(os.Stdout))
}
