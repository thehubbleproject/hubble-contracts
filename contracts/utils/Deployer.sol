import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

contract Deployer {
    event Deployed(address contractAddress);

    function deploy(bytes32 salt, bytes calldata bytecode)
        external
        returns (address)
    {
        address contractAddress = Create2.deploy(salt, bytecode);
        emit Deployed(contractAddress);
    }
}
