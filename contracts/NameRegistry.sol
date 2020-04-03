pragma solidity ^0.5.0;


contract NameRegistry {
    struct ContractDetails {
        // defines if the contract has permissions enabled or not
        // bool hasPermissions;
        // // if permissions are enabled, who is able to call this contract
        // address owner;
        // registered contract address
        address contractAddress;
    }

    mapping(string => ContractDetails) registry;

    function registerName(string name, address addr) external returns (bool) {
        ContractDetails memory info = registry[name];

        // create info if it doesn't exist in the registry
        if (info.contractAddress == address(0)) {
            info.contractAddress = addr;
            registry[name] = info;
            // added to registry
            return true;
        } else {
            // already was registered
            return false;
        }
    }

    function getContractDetails(string name) external view returns (address) {
        return (registry[name].contractAddress);
    }
}
