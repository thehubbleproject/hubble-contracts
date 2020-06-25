package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestKeccak256WithBytes(t *testing.T) {
	data := "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
	// solidity hash for string "1234"
	solidityHash := "0xf7a79db316c8c141dc284458d91846c8f898e9e125092eb4228266b471eb99d"
	hash, err := KeccakFromString(data)
	require.NoError(t, err, "error converting to bytes to solidity hash")
	require.Equal(t, solidityHash, hash.String(), "Hash should be equal")
}

func TestKeccakWithBytes32(t *testing.T) {

}
