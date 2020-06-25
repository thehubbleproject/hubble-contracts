package config

import (
	"text/template"
)

// Note: any changes to the comments/variables/mapstructure
// must be reflected in the appropriate struct in config/config.go
const defaultConfigTemplate = `# This is a TOML config file.

##### RPC configrations #####
# RPC endpoint for ethereum chain
eth_RPC_URL = "{{ .EthRPC }}"

##### DB configrations #####
db_type = "{{ .DB }}"
db_url = "{{ .DBURL }}"
trace = "{{ .Trace }}"
db_log_mode = "{{ .DBLogMode }}"

##### Server configrations #####
server_port = "{{ .ServerPort }}"
polling_interval = "{{ .PollingInterval }}"
txs_per_batch = "{{ .TxsPerBatch }}"

#### Keystore #####
operator_key = "{{ .OperatorKey }}"
operator_address = "{{ .OperatorAddress }}"

#### Syncer settings #####
last_recorded_block = "{{ .LastRecordedBlock }}"
confirmation_blocks = "{{ .ConfirmationBlocks }}"

##### Contract Addresses #####
rollup_address = "{{ .RollupAddress }}"
balance_tree_address = "{{ .BalanceTreeAddress }}"
account_tree_address = "{{ .AccountTreeAddress }}"
merkle_lib_address = "{{ .MerkleTreeLibAddress }}"
token_registry_address = "{{ .TokenRegistryAddress }}"
logger_address = "{{ .LoggerAddress }}"
deposit_manager_address = "{{ .DepositManagerAddress }}"
`

var configTemplate *template.Template

func init() {
	var err error
	tmpl := template.New("appConfigFileTemplate")
	if configTemplate, err = tmpl.Parse(defaultConfigTemplate); err != nil {
		panic(err)
	}
}
