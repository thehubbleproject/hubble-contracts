package core

import (
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/BOPR/common"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/willf/pad"
)

func GetParent(left, right ByteArray) (parent ByteArray, err error) {
	data, err := EncodeChildren(left, right)
	if err != nil {
		return parent, err
	}
	leaf := common.Keccak256(data)
	return BytesToByteArray(leaf.Bytes()), nil
}

func GetParentPath(path string) (parentNodePath string) {
	return TrimPathToParentPath(path)
}

func EncodeChildren(left, right ByteArray) (result []byte, err error) {
	bytes32Type, err := abi.NewType("bytes32", "bytes32", nil)
	if err != nil {
		return
	}

	arguments := abi.Arguments{
		{
			Type: bytes32Type,
		},
		{
			Type: bytes32Type,
		},
	}
	bz, err := arguments.Pack(
		[32]byte(left),
		[32]byte(right),
	)
	if err != nil {
		return
	}

	return bz, nil
}

func Keccak256AndConvertToByteArray(data []byte) ByteArray {
	hash := common.Keccak256(data)
	return BytesToByteArray(hash.Bytes())
}

func ToUint64(i *big.Int) uint64 {
	return i.Uint64()
}

func StringToBigInt(s string) *big.Int {
	t := big.NewInt(0)
	t.SetString(s, 2)
	return t
}

func UintToBigInt(a uint64) *big.Int {
	t := big.NewInt(0)
	t.SetUint64(a)
	return t
}

func GetBit(a uint64, index int) uint {
	b := UintToBigInt(a)
	return b.Bit(index)
}

func StringToUint(s string) (uint64, error) {
	i, err := strconv.ParseUint(s, 2, 64)
	if err != nil {
		return 0, err
	}
	return i, nil
}

func UintToString(a uint64) string {
	return strconv.FormatUint(a, 2)
}

func isRight(path string) bool {
	dataRune := []rune(path)
	// if the bit is 0
	if dataRune[len(path)-1] == 48 {
		return false
	} else {
		return true
	}
}

func GetNthBitFromRight(path string, index int) int {
	dataRune := []rune(path)
	// if the bit is 0
	if dataRune[len(dataRune)-index-1] == 48 {
		return 0
	} else {
		return 1
	}
}

func FlipBitInString(s string, i int) string {
	dataRune := []rune(s)
	if dataRune[i] == 48 {
		dataRune[i] = 49
	} else {
		dataRune[i] = 48
	}
	return string(dataRune)
}

func GetOtherChild(path string) string {
	return FlipBitInString(path, len(path)-1)
}

func TrimPathToParentPath(s string) string {
	r, size := utf8.DecodeLastRuneInString(s)
	if r == utf8.RuneError && (size == 0 || size == 1) {
		size = 0
	}
	return s[:len(s)-size]
}

func GenCoordinatorPath(depth uint64) string {
	var path []rune
	for i := uint64(0); i < depth; i++ {
		path = append(path, 48)
	}
	return string(path)
}

func GetAdjacentNodePath(path string) (string, error) {
	nodePath, err := StringToUint(path)
	if err != nil {
		return "", err
	}
	adjacentNodePath := nodePath + 1

	return pad.Left(UintToString(adjacentNodePath), len(path), "0"), nil
}

func padNumberWithZero(value string, depth uint64) string {
	return fmt.Sprintf("%03v", value)
}

func SolidityPathToNodePath(path uint64, depth uint64) (string, error) {
	pathWithoutPrefix := UintToString(path)
	// pad path with 0's to make it fit depth
	var pathToNode []rune
	for i := uint64(0); i < depth-uint64(len(pathWithoutPrefix)); i++ {
		pathToNode = append(pathToNode, 48)
	}
	generatedPath := strings.Join([]string{string(pathToNode), pathWithoutPrefix}, "")
	return generatedPath, nil
}
