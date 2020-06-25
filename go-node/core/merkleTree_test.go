package core

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetParent(t *testing.T) {
	SolLeftLeaf := "f7a79db316c8c141dc284458d91846c8f898e9e125092eb4228266b471eb99dd"
	SolRightLeaf := "ca4f7778bc3e232933768c40fe68cee3a1972f6cdfcf5898e52006c0d0dbef1e"
	SolRootLeaf := "5ac1dc940ea3d1014860cc07e1c76d2538e99b19d296d549b39bd4806ff574cc"

	leftleaf, err := HexToByteArray(SolLeftLeaf)
	require.NoError(t, err, "error converting to hex to byte array")
	rightLeaf, err := HexToByteArray(SolRightLeaf)
	require.NoError(t, err, "error converting to hex to byte array")

	parent, err := GetParent(leftleaf, rightLeaf)
	require.NoError(t, err)

	require.Equal(t, parent.String(), SolRootLeaf, "The root leaves should match")
}

func TestGenDefaultHashes(t *testing.T) {
	defaultHashes, err := GenDefaultHashes(1)
	require.NoError(t, err, "error generating default hashes")
	expected := "290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563"
	require.Equal(t, defaultHashes[0].String(), expected)
	defaultHashes, err = GenDefaultHashes(2)
	require.NoError(t, err, "error generating default hashes")
	fmt.Println("defaultHashes", defaultHashes[0].String(), defaultHashes[1].String())
	require.Equal(t, defaultHashes[0].String(), "290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563")
	require.Equal(t, defaultHashes[1].String(), "633dc4d7da7256660a892f8f1604a44b5432649cc8ec5cb3ced4c4e6ac94dd1d")
}

func TestGenMerkleRoot(t *testing.T) {
	// data from solidity
	// 	datablocks [ '0x3078313233000000000000000000000000000000000000000000000000000000',
	//   '0x3078333334000000000000000000000000000000000000000000000000000000',
	//   '0x3078343334330000000000000000000000000000000000000000000000000000',
	//   '0x3078333334000000000000000000000000000000000000000000000000000000' ]
	// root created 0xa45036c191964bdc1b15f93c9b9a01334c3cfb22a10eded555fa978de2c835f3
	dataBlocks := []string{
		"3078313233000000000000000000000000000000000000000000000000000000",
		"3078333334000000000000000000000000000000000000000000000000000000",
		"3078343334330000000000000000000000000000000000000000000000000000",
		"3078333334000000000000000000000000000000000000000000000000000000",
	}
	contents, err := NewContentList(dataBlocks)
	require.NoError(t, err, "error generating content list")
	root, err := GetMerkleRoot(contents, 4)
	require.NoError(t, err, "error creating root from content list")
	require.Equal(t, root.String(), "a45036c191964bdc1b15f93c9b9a01334c3cfb22a10eded555fa978de2c835f3")
}
