package main

import (
	"encoding/hex"
	"fmt"
	"math"

	agg "github.com/BOPR/aggregator"
	"github.com/BOPR/common"
	"github.com/BOPR/config"
	"github.com/BOPR/core"
	"github.com/ethereum/go-ethereum/crypto"
)

func main() {
	TestProcessTx()
}
func TestProcessTx() {
	db, err := core.NewDB()
	if err != nil {
		fmt.Println("error creating database")
		panic(err)
	}
	a := agg.NewAggregator(db)
	latestFromAcc, err := a.DB.GetAccountByID(uint64(2))
	if err != nil {
		fmt.Println("unable to fetch latest account", err)
		return
	}

	var txCore = core.Tx{
		From:    2,
		To:      3,
		Amount:  1,
		TokenID: 1,
		Nonce:   latestFromAcc.Nonce + 1,
	}

	signBytes, err := txCore.GetSignBytes()
	if err != nil {
		return
	}

	AlicePrivKey := "9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3"
	privKeyBytes, err := hex.DecodeString(AlicePrivKey)
	if err != nil {
		fmt.Println("unable to decode string", err)
		return
	}
	key := crypto.ToECDSAUnsafe(privKeyBytes)
	signature, err := crypto.Sign(signBytes, key)
	txCore.Signature = hex.EncodeToString(signature)
	var txs []core.Tx
	txs = append(txs, txCore)
	fromMerkleProof, _, PDA, err := db.GetTxVerificationData(txCore)
	if err != nil {
		fmt.Println("error", err)
		panic(err)
	}
	fmt.Println("fromMerkleProof", fromMerkleProof)
	rootAcc, err := a.DB.GetRoot()
	if err != nil {
		panic(err)
	}

	fromAccount, err := db.GetAccountByID(2)
	PDAAbiVersion := PDA.ToABIVersion()
	fmt.Println("pubkey", fromAccount.PubkeyHashToByteArray())
	result, err := a.LoadedBazooka.VerifyPDAProof(rootAcc.PubkeyHashToByteArray(),
		fromAccount.PubkeyHashToByteArray(),
		PDAAbiVersion.Pda.PathToPubkey,
		PDAAbiVersion.Siblings)
	if err != nil {
		panic(err)
	}

	// if err := a.LoadedBazooka.ValidateAccountMP(rootAcc.HashToByteArray(), fromMerkleProof); err != nil {
	// 	panic(err)
	// }

	// if err := a.LoadedBazooka.ValidateSignature(txCore, PDA); err != nil {
	// 	panic(err)
	// }

	fmt.Println(result)
	// TODO start from checking the MP's manually before sending
}

// func TestDeposit() {
// 	db, err := core.NewDB()
// 	if err != nil {
// 		fmt.Println("error creating database")
// 		panic(err)
// 	}
// 	core.DBInstance = db
// 	// read genesis file
// 	genesis, err := config.ReadGenesisFile()
// 	common.PanicIfError(err)

// 	// loads genesis data to the database
// 	LoadGenesisData(genesis)

// 	newParams := core.Params{StakeAmount: genesis.StakeAmount, MaxDepth: genesis.MaxTreeDepth, MaxDepositSubTreeHeight: genesis.MaxDepositSubTreeHeight}
// 	core.DBInstance.UpdateStakeAmount(newParams.StakeAmount)
// 	core.DBInstance.UpdateMaxDepth(newParams.MaxDepth)
// 	core.DBInstance.UpdateDepositSubTreeHeight(newParams.MaxDepositSubTreeHeight)

// 	// add bob and alice account
// 	Alice := core.NewPendingUserAccount(1, 10, 1, "0x914873c8d5935837ade39cbdabd6efb3d3d4064c5918da11e555bba0ab2c58fee95974a3222830cf73d257bdc18cfcd01765482108a48e68bc0b657618acb40e")
// 	Alice.CreateAccountHash()
// 	Bob := core.NewPendingUserAccount(2, 10, 1, "0x90718dcbc2477c86294742fb72bf098ba85ff671b88c8d79b2e09ce19bdbd88fd87047aaebc775b168372752aa8bc4e5be1ca5d39284fed00722f341927888c3")
// 	Bob.CreateAccountHash()
// 	err = db.AddNewPendingAccount(*Alice)
// 	if err != nil {
// 		panic(err)
// 	}
// 	err = db.AddNewPendingAccount(*Bob)
// 	if err != nil {
// 		panic(err)
// 	}
// 	syncer := listener.NewSyncer()
// 	syncer.Start()
// 	defer syncer.Stop()
// 	syncer.SendDepositFinalisationTx()

// 	// create deposit
// 	// pathToDepositSubTree := "010"
// 	root, err := core.HexToByteArray("0x6aee22e4704db7157c8ad4df7d2509fd5e31117f50d29ce7d7320b59d9a78880")
// 	if err != nil {
// 		panic(err)
// 	}
// 	Newroot, err := db.FinaliseDepositsAndAddBatch(core.ByteArray{}, 1, root)
// 	if err != nil {
// 		panic(err)
// 	}
// 	fmt.Println("new rot", Newroot, "0x6aee22e4704db7157c8ad4df7d2509fd5e31117f50d29ce7d7320b59d9a78880")
// }

func TestLIKE() {
	db, err := core.NewDB()
	if err != nil {
		fmt.Println("error creating database")
		panic(err)
	}
	core.DBInstance = db
	// read genesis file
	genesis, err := config.ReadGenesisFile()
	common.PanicIfError(err)

	// loads genesis data to the database
	LoadGenesisData(genesis)
	result, err := db.GetAllTerminalNodes("011")
	if err != nil {
		panic(err)
	}

	fmt.Println("result", result)
}
func TestStoreNode() {
	db, err := core.NewDB()
	if err != nil {
		fmt.Println("error creating database")
		panic(err)
	}
	core.DBInstance = db
	// read genesis file
	genesis, err := config.ReadGenesisFile()
	common.PanicIfError(err)

	// loads genesis data to the database
	LoadGenesisData(genesis)
	pathToUpdate := "0000"
	// pathsThatWillBeUpdated:=string["000","00","0"]
	fmt.Println("--------------------------------")
	var newAccount = core.EmptyAccount()
	newAccount.Path = pathToUpdate
	newAccount.TokenType = 1
	newAccount.CreateAccountHash()
	defaultHashse, err := core.GenDefaultHashes(4)
	if err != nil {
		panic(err)
	}
	newAccountHash, err := core.HexToByteArray(newAccount.Hash)
	if err != nil {
		panic(err)
	}
	fmt.Println("using", newAccountHash.String(), defaultHashse[0].String())
	parent, err := core.GetParent(newAccountHash, defaultHashse[0])
	fmt.Println("000 should be", parent.String())
	siblings, err := db.GetSiblings(pathToUpdate)
	if err != nil {
		panic(err)
	}

	// account, err := db.GetAccountByPath("0001")
	// fmt.Println("account here", account, "path", account.Path)
	fmt.Println("siblings", siblings)

	err = db.StoreLeaf(newAccount, pathToUpdate, siblings)
	if err != nil {
		panic(err)
	}

}

// LoadGenesisData helps load the genesis data into the DB
func LoadGenesisData(genesis config.Genesis) {
	err := genesis.Validate()
	if err != nil {
		common.PanicIfError(err)
	}

	diff := int(math.Exp2(float64(genesis.MaxTreeDepth))) - len(genesis.GenesisAccounts.Accounts)
	var allAccounts []core.UserAccount

	// convert genesis accounts to user accounts
	for _, account := range genesis.GenesisAccounts.Accounts {
		allAccounts = append(
			allAccounts,
			core.UserAccount{
				AccountID: account.ID,
				Balance:   account.Balance,
				TokenType: account.TokenType,
				Nonce:     account.Nonce,
				Status:    account.Status,
				PublicKey: account.PublicKey,
			},
		)
	}

	// fill the tree with zero leaves
	for diff > 0 {
		newAcc := core.EmptyAccount()
		newAcc.Hash = core.ZERO_VALUE_LEAF.String()
		allAccounts = append(allAccounts, newAcc)
		diff--
	}

	// load accounts
	err = core.DBInstance.InitBalancesTree(genesis.MaxTreeDepth, allAccounts)
	common.PanicIfError(err)

	// load params
	newParams := core.Params{StakeAmount: genesis.StakeAmount, MaxDepth: genesis.MaxTreeDepth, MaxDepositSubTreeHeight: genesis.MaxDepositSubTreeHeight}
	core.DBInstance.UpdateStakeAmount(newParams.StakeAmount)
	core.DBInstance.UpdateMaxDepth(newParams.MaxDepth)
	core.DBInstance.UpdateDepositSubTreeHeight(newParams.MaxDepositSubTreeHeight)

	// load sync status
	core.DBInstance.UpdateSyncStatusWithBlockNumber(genesis.StartEthBlock)
	core.DBInstance.UpdateSyncStatusWithBatchNumber(0)
}
func TestTxHash() {
	tx := core.NewPendingTx(1, 1, 1, 1, "1", 1)
	tx.AssignHash()
	fmt.Println("tx hash:", tx.TxHash)

}

func TestTrim() {
	fmt.Println(core.TrimPathToParentPath("1001"))
}
func TestUserAccountUpdate() {
	db, err := core.NewDB()
	if err != nil {
		fmt.Println("error creating database")
		panic(err)

	}
	fmt.Println("created DB", db)
	var newAcc core.UserAccount
	// originalAccountPath := "100"
	newAcc.Status = 100
	newAcc.AccountID = 100
	newAcc.Path = "000"
	var nomalAccount = core.EmptyAccount()
	// nomalAccount := *core.NewUserAccount(acc.ID, acc.Balance, acc.TokenType, "", acc.Nonce, int(acc.Status), acc.PublicKey)
	fmt.Println("new accout", newAcc)
	var accounts []core.UserAccount
	accounts = append(accounts, newAcc)
	i := 7
	for i > 0 {
		accounts = append(accounts, nomalAccount)
		i--
	}
	err = db.InitBalancesTree(3, accounts)
	fmt.Println("err", err)
	// err = db.Instance.Model(core.UserAccount).Updates().Error
	// if err != nil {
	// 	panic(err)
	// }
	// var user core.UserAccount
	// err = db.Instance.Where("path = ?", "").First(&user).Error
	// fmt.Println("user", user, err)

	// newAcc.AccountID = 1001
	// newAcc.Path = "10101"
	// err = db.Instance.Create(&newAcc).Error
	// if err != nil {
	// 	panic(err)
	// }
	// newAcc.AccountID = 102
	// newAcc.Path = "01"
	// err = db.Instance.Model(&newAcc).Where("path = ?", originalAccountPath).Update(&newAcc).Error
	// if err != nil {
	// 	panic(err)
	// }
}

// func TestABIEncodeAndDecode() {
// 	RPCClient, err := rpc.Dial("")
// 	client := ethclient.NewClient(RPCClient)
// 	rollupContractAddress := ethCmn.HexToAddress("0x61b14bAA77069494fCff00EAeeCf0212d5Ac1d10")
// 	instance, err := trial.NewTrial(rollupContractAddress, client)
// 	if err != nil {
// 		panic(err)
// 	}

// 	rollupABI, err := abi.JSON(strings.NewReader(trial.TrialABI))
// 	from := trial.TrialUserAccount{
// 		ID:        big.NewInt(100),
// 		Balance:   big.NewInt(100),
// 		TokenType: big.NewInt(100),
// 		Nonce:     big.NewInt(100),
// 	}

// 	txData := trial.TrialTransaction{
// 		From:      from,
// 		To:        from,
// 		TokenType: big.NewInt(100),
// 		Amount:    100,
// 		Signature: []byte("dsds"),
// 	}

// 	data, err := rollupABI.Pack("ABIEncodeTransaction", txData)
// 	if err != nil {
// 		fmt.Println("Unable to pack tx for approve", "error", err)
// 	}

// 	// generate call msg
// 	callMsg := ethereum.CallMsg{
// 		To:   &rollupContractAddress,
// 		Data: data,
// 	}

// 	auth, err := bazooka.GenerateAuthObj(client, callMsg)
// 	fmt.Println("auth generated", auth, err)

// 	tx, err := instance.ABIEncodeTransaction(auth, txData)
// 	if err != nil {
// 		fmt.Println("Unable to send tx", err)
// 	}
// 	fmt.Println("sent transaction", tx.Hash().String())
// }

// func TestCallData() {
// 	RPCClient, err := rpc.Dial("")
// 	client := ethclient.NewClient(RPCClient)
// 	tx, _, err := client.TransactionByHash(context.Background(), ethCmn.HexToHash("0x16325b88c533d8e75be9efefa2e96a39c75e106ec6d0974da1f143702b181809"))
// 	if err != nil {
// 		panic(err)
// 	}
// 	fmt.Println("transaction", hex.EncodeToString(tx.Data()))

// 	myAbi, err := abi.JSON(strings.NewReader("[{\"constant\":false,\"inputs\":[{\"internalType\":\"bytes[]\",\"name\":\"_txs\",\"type\":\"bytes[]\"}],\"name\":\"Batch\",\"outputs\":[],\"payable\":false,\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]"))
// 	if err != nil {
// 		log.Fatal(err)
// 	}
// 	fmt.Println("length", len(tx.Data()))
// 	payload := tx.Data()
// 	decodedPayload := payload[4:]
// 	inputDataMsap := make(map[string]interface{})
// 	method := myAbi.Methods["Batch"]
// 	err = method.Inputs.UnpackIntoMap(inputDataMsap, decodedPayload)
// 	if err != nil {
// 		log.Fatal("error decoding", err)
// 	}

// 	fmt.Println("decoded data", hex.EncodeToString(inputDataMsap["_txs"].([][]byte)[2]))
// }

// func TestSyncer() {
// 	config.ParseAndInitGlobalConfig()
// 	syncer := listener.NewSyncer()
// 	batch := types.Batch{StakeAmount: 100}
// 	fmt.Println(syncer.DBInstance.AddNewBatch(batch))
// 	syncer.DBInstance.StoreListenerLog(types.ListenerLog{LastRecordedBlock: "101"})
// 	if err := syncer.Start(); err != nil {
// 		log.Fatalln("Unable to start syncer", "error")
// 	}

// 	// go routine to catch signal
// 	catchSignal := make(chan os.Signal, 1)
// 	signal.Notify(catchSignal, os.Interrupt)
// 	go func() {
// 		// sig is a ^C, handle it
// 		for range catchSignal {
// 			syncer.Stop()
// 			// exit
// 			os.Exit(1)
// 		}
// 	}()
// 	r := mux.NewRouter()
// 	http.ListenAndServe(":8080", r)
// }
