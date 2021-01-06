pragma solidity ^0.5.15;

import { ModexpInverse } from "./ModExp.sol";

contract Inv {
    function inverseEEACost(uint256 e, uint256 p) external returns (uint256) {
        uint256 g = gasleft();
        _inverseEEA(e, p);
        return g - gasleft();
    }

    function inverseEEA(uint256 e, uint256 p) external pure returns (uint256) {
        return _inverseEEA(e, p);
    }

    function _inverseEEA(uint256 e, uint256 p) internal pure returns (uint256) {
        uint256 u = e;
        uint256 v = p;
        uint256 x1 = 1;
        uint256 x2 = 0;
        while (u != 1 && v != 1) {
            // u is even
            while (u & 1 == 0) {
                u = u >> 1;
                if (x1 & 1 == 1) {
                    x1 = x1 + p;
                }
                x1 = x1 >> 1;
            }

            // v is even
            while (v & 1 == 0) {
                v = v >> 1;
                if (x2 & 1 == 1) {
                    x2 = x2 + p;
                }
                x2 = x2 >> 1;
            }

            if (u < v) {
                v = v - u;
                x2 = addmod(x2, p - x1, p);
            } else {
                u = u - v;
                x1 = addmod(x1, p - x2, p);
            }
        }
        if (u == 1) {
            return x1;
        }
        return x2;
    }

    function inverseModexpCost(uint256 e) external returns (uint256) {
        uint256 g = gasleft();
        ModexpInverse.run(e);
        return g - gasleft();
    }

    function inverseModexp(uint256 e) external pure returns (uint256) {
        return ModexpInverse.run(e);
    }
}
