package main

import (
	"encoding/hex"

	"github.com/BOPR/common"
	"github.com/BOPR/config"
	"github.com/spf13/cobra"
)

// InitCmd generated init command to initialise the config file
func InitCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Initialises Configration for BOPR",
		Run: func(cmd *cobra.Command, args []string) {
			defaultConfig := config.GetDefaultConfig()
			operatorKey, err := config.GenOperatorKey()
			common.PanicIfError(err)
			defaultConfig.OperatorKey = hex.EncodeToString(operatorKey)
			address, err := config.PrivKeyStringToAddress(hex.EncodeToString(operatorKey))
			common.PanicIfError(err)
			defaultConfig.OperatorAddress = address.String()
			config.WriteConfigFile("./config.toml", &defaultConfig)
			gen := config.DefaultGenesis()
			if err := config.WriteGenesisFile(gen); err != nil {
				panic(err)
			}
		},
	}
}
