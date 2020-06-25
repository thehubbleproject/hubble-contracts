package core

import (
	"encoding/hex"
)

var defaultHashes []ByteArray

// depicts the empty leaf in balance tree
var ZERO_VALUE_LEAF ByteArray

func init() {
	var err error

	ZERO_VALUE_LEAF, err = HexToByteArray("0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563")
	if err != nil {
		panic(err)
	}

	// TODO change and pick from global config
	defaultHashes, err = GenDefaultHashes(100)
	if err != nil {
		panic(err)
	}
}

func GenDefaultHashes(depth int) ([]ByteArray, error) {
	hashes := make([]ByteArray, depth)
	hashes[0] = ZERO_VALUE_LEAF
	for i := 1; i < depth; i++ {
		parent, err := GetParent(hashes[i-1], hashes[i-1])
		if err != nil {
			return hashes, err
		}
		hashes[i] = parent
	}
	return hashes, nil
}

type Content struct {
	data []byte
}

func (c *Content) Populate(data []byte) {
	c.data = data

}

func NewContentList(dataLeaves []string) ([]Content, error) {
	var contentList []Content
	for _, dataLeaf := range dataLeaves {
		var c Content
		bz, err := hex.DecodeString(dataLeaf)
		if err != nil {
			return contentList, err
		}
		c.Populate(bz)
		contentList = append(contentList, c)
	}
	return contentList, nil
}

func GetMerkleRoot(c []Content, numberOfElements int) (root ByteArray, err error) {
	nextLevelLength := numberOfElements
	currentLevel := 0
	nodes := make([]ByteArray, numberOfElements+1)
	for i := 0; i < numberOfElements; i++ {
		nodes[i] = Keccak256AndConvertToByteArray(c[i].data)
	}
	if numberOfElements == 1 {
		return nodes[0], nil
	}

	if nextLevelLength%2 == 1 {
		nodes[nextLevelLength] = defaultHashes[currentLevel]
		nextLevelLength += 1
	}

	for nextLevelLength > 1 {
		currentLevel += 1
		for i := 0; i < nextLevelLength/2; i++ {
			nodes[i], err = GetParent(nodes[i*2], nodes[i*2+1])
			if err != nil {
				return
			}
		}
		nextLevelLength = nextLevelLength / 2
		// Check if we will need to add an extra node
		if nextLevelLength%2 == 1 && nextLevelLength != 1 {
			nodes[nextLevelLength] = defaultHashes[currentLevel]
			nextLevelLength += 1
		}
	}
	return nodes[0], nil
}
