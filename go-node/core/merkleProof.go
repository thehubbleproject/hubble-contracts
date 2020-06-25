package core

import (
	"encoding/hex"

	"github.com/BOPR/contracts/rollup"
)

type AccountMerkleProof struct {
	Account  UserAccount
	Siblings []UserAccount
}

func NewAccountMerkleProof(account UserAccount, siblings []UserAccount) AccountMerkleProof {
	return AccountMerkleProof{Account: account, Siblings: siblings}
}

func (m *AccountMerkleProof) ToABIVersion() rollup.TypesAccountMerkleProof {
	// create siblings
	var siblingNodes [][32]byte
	for _, s := range m.Siblings {
		siblingNodes = append(siblingNodes, s.HashToByteArray())
	}

	return rollup.TypesAccountMerkleProof{
		AccountIP: rollup.TypesAccountInclusionProof{
			PathToAccount: StringToBigInt(m.Account.Path),
			Account:       m.Account.ToABIAccount(),
		},
		Siblings: siblingNodes,
	}
}

type PDAMerkleProof struct {
	Path      string
	PublicKey string
	Siblings  []UserAccount
}

func NewPDAProof(path string, publicKey string, siblings []UserAccount) PDAMerkleProof {
	return PDAMerkleProof{PublicKey: publicKey, Siblings: siblings, Path: path}
}

func (m *PDAMerkleProof) ToABIVersion() rollup.TypesPDAMerkleProof {
	// create siblings
	var siblingNodes [][32]byte
	for _, s := range m.Siblings {
		siblingNodes = append(siblingNodes, s.PubkeyHashToByteArray())
	}
	pubkey, err := hex.DecodeString(m.PublicKey)
	if err != nil {
		panic(err)
	}
	return rollup.TypesPDAMerkleProof{
		Pda: rollup.TypesPDAInclusionProof{
			PathToPubkey: StringToBigInt(m.Path),
			PubkeyLeaf:   rollup.TypesPDALeaf{Pubkey: pubkey},
		},
		Siblings: siblingNodes,
	}
}
