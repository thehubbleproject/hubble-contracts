export class HubbleError extends Error {}

export class EncodingError extends HubbleError {}

export class MismatchByteLength extends HubbleError {}

export class GenesisNotSpecified extends HubbleError {}

export class UserNotExist extends HubbleError {}

class StateTreeExceptions extends HubbleError {}

export class SenderNotExist extends StateTreeExceptions {}

export class ReceiverNotExist extends StateTreeExceptions {}

export class StateAlreadyExist extends StateTreeExceptions {}

export class WrongTokenID extends StateTreeExceptions {}

export class InsufficientFund extends StateTreeExceptions {}
