pragma solidity ^0.5.15;
pragma experimental ABIEncoderV2;

import { Tx } from "../libs/Tx.sol";
import { Types } from "../libs/Types.sol";

contract TestTx {
    using Tx for bytes;

    function transfer_serialize(Tx.Transfer[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transfer_serializeFromEncoded(bytes[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function transfer_bytesFromEncoded(Types.Transfer memory _tx)
        public
        pure
        returns (bytes memory)
    {
        return
            abi.encode(
                Types.Usage.Transfer,
                _tx.fromIndex,
                _tx.toIndex,
                _tx.tokenType,
                _tx.nonce,
                _tx.amount,
                _tx.signature
            );
    }

    function transfer_hasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.transfer_hasExcessData();
    }

    function transfer_size(bytes memory txs) public pure returns (uint256) {
        return txs.transfer_size();
    }

    function transfer_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.Transfer memory)
    {
        return Tx.transfer_decode(txs, index);
    }

    function transfer_amountOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_amountOf(index);
    }

    function transfer_fromIndexOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_fromIndexOf(index);
    }

    function transfer_toIndexOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (uint256)
    {
        return txs.transfer_toIndexOf(index);
    }

    function transfer_signatureOf(bytes calldata txs, uint256 index)
        external
        pure
        returns (bytes memory)
    {
        return txs.transfer_signatureOf(index);
    }

    function create_serializeFromEncoded(bytes[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.create_serializeFromEncoded(txs);
    }

    function create_serialize(Tx.CreateAccount[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function create_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.CreateAccount memory)
    {
        return Tx.create_decode(txs, index);
    }

    function create_hasExcessData(bytes memory txs) public pure returns (bool) {
        return txs.create_hasExcessData();
    }

    function create_size(bytes memory txs) public pure returns (uint256) {
        return txs.create_size();
    }

    function create_accountIdOf(bytes memory txs, uint256 index)
        public
        pure
        returns (uint256)
    {
        return txs.create_accountIdOf(index);
    }

    function create_stateIdOf(bytes memory txs, uint256 index)
        public
        pure
        returns (uint256)
    {
        return txs.create_stateIdOf(index);
    }

    function create_tokenOf(bytes memory txs, uint256 index)
        public
        pure
        returns (uint256)
    {
        return txs.create_tokenOf(index);
    }

    function burnConsent_serializeFromEncoded(bytes[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.burnConsent_serializeFromEncoded(txs);
    }

    function burnConsent_serialize(Tx.BurnConsent[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function burnConsent_decode(bytes memory txs, uint256 index)
        public
        pure
        returns (Tx.BurnConsent memory)
    {
        return txs.burnConsent_decode(index);
    }

    function burnConsent_hasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.burnConsent_hasExcessData();
    }

    function burnConsent_size(bytes memory txs) public pure returns (uint256) {
        return txs.burnConsent_size();
    }

    function burnConsent_fromIndexOf(bytes memory txs, uint256 index)
        public
        pure
        returns (uint256)
    {
        return txs.burnConsent_fromIndexOf(index);
    }

    function burnConsent_amountOf(bytes memory txs, uint256 index)
        public
        pure
        returns (uint256)
    {
        return txs.burnConsent_amountOf(index);
    }

    function burnConsent_signatureOf(bytes memory txs, uint256 index)
        public
        pure
        returns (bytes memory)
    {
        return txs.burnConsent_signatureOf(index);
    }

    function burnExecution_serializeFromEncoded(bytes[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.burnExecution_serializeFromEncoded(txs);
    }

    function burnExecution_serialize(Tx.BurnExecution[] memory txs)
        public
        pure
        returns (bytes memory)
    {
        return Tx.serialize(txs);
    }

    function burnExecution_hasExcessData(bytes memory txs)
        public
        pure
        returns (bool)
    {
        return txs.burnExecution_hasExcessData();
    }

    function burnExecution_size(bytes memory txs)
        public
        pure
        returns (uint256)
    {
        return txs.burnExecution_size();
    }

    function burnExecution_fromIndexOf(bytes memory txs, uint256 index)
        public
        pure
        returns (uint256 sender)
    {
        return txs.burnExecution_fromIndexOf(index);
    }
}
