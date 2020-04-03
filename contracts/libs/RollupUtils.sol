pragma solidity ^0.5.0;


library RollupUtils {
    // ---------- Account Related Utils -------------------
    function PDALeafToHash(dataTypes.PDALeaf memory _PDA_Leaf)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(_PDA_Leaf.pubkey));
    }

    // returns a new User Account with updated balance
    function UpdateBalanceInAccount(
        dataTypes.UserAccount memory original_account,
        uint256 new_balance
    ) public pure returns (dataTypes.UserAccount memory updated_account) {
        original_account.balance = new_balance;
        return original_account;
    }

    function BalanceFromAccount(dataTypes.UserAccount memory account)
        public
        pure
        returns (uint256)
    {
        return account.balance;
    }

    function HashFromAccount(dataTypes.UserAccount memory account)
        public
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromAccount(account));
    }

    function BytesFromAccount(dataTypes.UserAccount memory account)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                account.ID,
                account.balance,
                account.nonce,
                account.tokenType
            );
    }

    // ---------- Tx Related Utils -------------------

    function BytesFromTx(dataTypes.Transaction memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return abi.encode(_tx);
    }

    function HashFromTx(dataTypes.Transaction memory _tx)
        public
        pure
        returns (bytes32)
    {
        return keccak256(BytesFromTx(_tx));
    }

    function getBalanceTreeRoot() public view returns (bytes32) {
        return balancesTree.getRoot();
    }

    /**
     * @notice Concatenates 2 deposits
     * @return Returns the final hash
     */
    function getDepositsHash(bytes32 a, bytes32 b)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(a, b));
    }

    /**
     * @notice Gives the number of batches submitted on-chain
     * @return Total number of batches submitted onchain
     */
    function numberOfBatches() public view returns (uint256) {
        return batches.length;
    }

    /**
     * @notice Calculates the address from the pubkey
     * @param pub is the pubkey
     * @return Returns the address that has been calculated from the pubkey
     */
    function calculateAddress(bytes memory pub)
        public
        pure
        returns (address addr)
    {
        bytes32 hash = keccak256(pub);
        assembly {
            mstore(0, hash)
            addr := mload(0)
        }
    }
}
