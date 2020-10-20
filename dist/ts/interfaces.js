"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Result = exports.Usage = void 0;
var Usage;
(function (Usage) {
    Usage[Usage["Genesis"] = 0] = "Genesis";
    Usage[Usage["Transfer"] = 1] = "Transfer";
    Usage[Usage["MassMigration"] = 2] = "MassMigration";
})(Usage = exports.Usage || (exports.Usage = {}));
var Result;
(function (Result) {
    Result[Result["Ok"] = 0] = "Ok";
    Result[Result["InvalidTokenAddress"] = 1] = "InvalidTokenAddress";
    Result[Result["InvalidTokenAmount"] = 2] = "InvalidTokenAmount";
    Result[Result["NotEnoughTokenBalance"] = 3] = "NotEnoughTokenBalance";
    Result[Result["BadFromTokenType"] = 4] = "BadFromTokenType";
    Result[Result["BadToTokenType"] = 5] = "BadToTokenType";
    Result[Result["BadFromIndex"] = 6] = "BadFromIndex";
    Result[Result["NotOnDesignatedStateLeaf"] = 7] = "NotOnDesignatedStateLeaf";
    Result[Result["BadSignature"] = 8] = "BadSignature";
    Result[Result["MismatchedAmount"] = 9] = "MismatchedAmount";
    Result[Result["BadWithdrawRoot"] = 10] = "BadWithdrawRoot";
})(Result = exports.Result || (exports.Result = {}));
//# sourceMappingURL=interfaces.js.map