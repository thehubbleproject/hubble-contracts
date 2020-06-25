package listener

import (
	"fmt"
	"math/big"
	"testing"

	"github.com/BOPR/types"
)

func TestPathConversion(t *testing.T) {
	path := "100101010"
	pathBig := big.NewInt(0)
	pathBig.SetString(path, 2)
	fmt.Println("path", pathBig.String())
	expectedSubPath := "101"
	expectedPathBig := big.NewInt(0)
	expectedPathBig.SetString(expectedSubPath, 2)
	fmt.Println("path", expectedPathBig.String())
	// testing bitwise add with big ints
	fmt.Println(expectedPathBig.Bit(2))
}

func TestStringToUint(t *testing.T) {
	data, err := types.StringToUint("101")
	fmt.Println("error", data, err)
}

func TestFlipBitInString(t *testing.T) {
	fmt.Println(types.FlipBitInInt("101", 1))
}
