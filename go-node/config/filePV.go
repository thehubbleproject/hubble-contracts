package config

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"

	ethCmn "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	cmn "github.com/tendermint/tendermint/libs/common"
	"github.com/tendermint/tendermint/types"

	"crypto/ecdsa"
)

//-------------------------------------------------------------------------------

// FilePVKey stores the immutable part of PrivValidator.
type FilePVKey struct {
	Address ethCmn.Address   `json:"address"`
	PubKey  ecdsa.PublicKey  `json:"pub_key"`
	PrivKey ecdsa.PrivateKey `json:"priv_key"`

	filePath string
}

// Save persists the FilePVKey to its filePath.
func (pvKey FilePVKey) Save() {
	outFile := pvKey.filePath
	if outFile == "" {
		panic("cannot save PrivValidator key: filePath not set")
	}

	jsonBytes, err := json.Marshal(pvKey)
	if err != nil {
		panic(err)
	}

	err = cmn.WriteFileAtomic(outFile, jsonBytes, 0600)
	if err != nil {
		panic(err)
	}

}

//-------------------------------------------------------------------------------

// FilePV implements PrivValidator using data persisted to disk
// to prevent double signing.
// NOTE: the directories containing pv.Key.filePath and pv.LastSignState.filePath must already exist.
// It includes the LastSignature and LastSignBytes so we don't lose the signature
// if the process crashes after signing but before the resulting consensus message is processed.
type FilePV struct {
	Key FilePVKey
}

// GenFilePV generates a new validator with randomly generated private key
// and sets the filePaths, but does not call Save().
func GenFilePV(keyFilePath string) *FilePV {
	// privKey := secp256k1.GenPrivKey()
	privKey, err := crypto.GenerateKey()
	if err != nil {
		return &FilePV{}
	}
	return &FilePV{
		Key: FilePVKey{
			Address:  PrivKeyToAddress(privKey),
			PubKey:   PrivToPubkey(privKey),
			PrivKey:  *privKey,
			filePath: keyFilePath,
		},
	}
}

// PrivToPubkey private key to public key
func PrivToPubkey(privKey *ecdsa.PrivateKey) ecdsa.PublicKey {
	publicKey := privKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		log.Fatal("cannot assert type: publicKey is not of type *ecdsa.PublicKey")
	}
	return *publicKeyECDSA
}

func PrivKeyToAddress(privKey *ecdsa.PrivateKey) ethCmn.Address {
	pubKey := PrivToPubkey(privKey)
	return PubKeyToAddress(&pubKey)
}

// PubKeyToAddress public key to address
func PubKeyToAddress(pubKey *ecdsa.PublicKey) ethCmn.Address {
	return crypto.PubkeyToAddress(*pubKey)
}

// PubKeyToString converts public key human readable string
func PubKeyToString(pubKey *ecdsa.PublicKey) string {
	publicKeyBytes := crypto.FromECDSAPub(pubKey)
	return hexutil.Encode(publicKeyBytes)[4:]
}

// LoadFilePV loads a FilePV from the filePaths.  The FilePV handles double
// signing prevention by persisting data to the stateFilePath.  If either file path
// does not exist, the program will exit.
func LoadFilePV(keyFilePath string) *FilePV {
	return loadFilePV(keyFilePath)
}

// LoadFilePVEmptyState loads a FilePV from the given keyFilePath, with an empty LastSignState.
// If the keyFilePath does not exist, the program will exit.
func LoadFilePVEmptyState(keyFilePath string) *FilePV {
	return loadFilePV(keyFilePath)
}

// If loadState is true, we load from the stateFilePath. Otherwise, we use an empty LastSignState.
func loadFilePV(keyFilePath string) *FilePV {
	keyJSONBytes, err := ioutil.ReadFile(keyFilePath)
	if err != nil {
		cmn.Exit(err.Error())
	}
	var pvKey FilePVKey

	err = json.Unmarshal(keyJSONBytes, &pvKey)
	if err != nil {
		cmn.Exit(fmt.Sprintf("Error reading PrivValidator key from %v: %v\n", keyFilePath, err))
	}

	// overwrite pubkey and address for convenience
	pvKey.PubKey = PrivToPubkey(&pvKey.PrivKey)
	pvKey.Address = PrivKeyToAddress(&pvKey.PrivKey)
	pvKey.filePath = keyFilePath

	return &FilePV{
		Key: pvKey,
	}
}

// LoadOrGenFilePV loads a FilePV from the given filePaths
// or else generates a new one and saves it to the filePaths.
func LoadOrGenFilePV(keyFilePath string) *FilePV {
	var pv *FilePV
	if cmn.FileExists(keyFilePath) {
		pv = LoadFilePV(keyFilePath)
	} else {
		pv = GenFilePV(keyFilePath)
		pv.Save()
	}
	return pv
}

// GetAddress returns the address of the validator.
// Implements PrivValidator.
func (pv *FilePV) GetAddress() ethCmn.Address {
	return pv.Key.Address
}

// GetPubKey returns the public key of the validator.
// Implements PrivValidator.
func (pv *FilePV) GetPubKey() ecdsa.PublicKey {
	return pv.Key.PubKey
}

// Save persists the FilePV to disk.
func (pv *FilePV) Save() {
	pv.Key.Save()
}

func (pv *FilePV) signBatch(chainID string, vote *types.Vote) error {
	return nil
}
