"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MismatchByteLength = exports.EncodingError = exports.HubbleError = void 0;
class HubbleError extends Error {
}
exports.HubbleError = HubbleError;
class EncodingError extends HubbleError {
}
exports.EncodingError = EncodingError;
class MismatchByteLength extends HubbleError {
}
exports.MismatchByteLength = MismatchByteLength;
//# sourceMappingURL=exceptions.js.map