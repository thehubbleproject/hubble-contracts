package common

import (
	"encoding/binary"
	"encoding/hex"
	"math"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func UintTo2Byte(a uint32) [2]byte {
	b := make([]byte, 4)
	binary.LittleEndian.PutUint32(b, a)
	// c := make([]byte, 2)
	var c [2]byte
	copy(c[:], b[:])
	return c
}

func UintToByte(a uint32) []byte {
	b := make([]byte, 4)
	binary.LittleEndian.PutUint32(b, a)
	return b
}

// AppendSlices appens multiple data slices
func AppendSlices(dataSlices [][]byte) (result []byte) {
	for _, data := range dataSlices {
		result = append(result, data...)
	}
	return
}

func PanicIfError(err error) {
	if err != nil {
		panic(err)
	}
}

func ExtractBit(num, place int) int {
	r := num % int(math.Pow(10, float64(place)))
	return r / int(math.Pow(10, float64(place-1)))
}

func FlipBit(bit int) int {
	if bit == 1 {
		return 0
	}
	return 1
}

func Keccak256(data []byte) common.Hash {
	return crypto.Keccak256Hash(data)
}

func KeccakFromString(data string) (hash common.Hash, err error) {
	bz, err := hex.DecodeString(data)
	if err != nil {
		return
	}
	return Keccak256(bz), nil

}
