package core

import (
	"encoding/hex"

	ethCmn "github.com/ethereum/go-ethereum/common"
)

type Hash ethCmn.Hash
type Address ethCmn.Address

type ByteArray [32]byte

func (b ByteArray) String() string {
	bz := b[:]
	enc := make([]byte, len(bz)*2+2)
	copy(enc, "0x")
	hex.Encode(enc[2:], bz)
	return string(enc)
}

// String has to be prefixed with 0x
func HexToByteArray(a string) (b ByteArray, err error) {
	bz, err := hex.DecodeString(a[2:])
	if err != nil {
		return b, err
	}
	return BytesToByteArray(bz), nil
}

func BytesToByteArray(bz []byte) ByteArray {
	var temp [32]byte
	copy(temp[:], bz)
	return temp
}
