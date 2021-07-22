/**
 * Consider using this as wrapper for feeReceivers, with updates
 * https://github.com/thehubbleproject/hubble-contracts/issues/628
 */
import fs from "fs";

export class Tokenbase {
    constructor(private receivers: { [key: number]: number }) {}

    updateReceiver(tokenID: number, stateID: number) {
        this.receivers[tokenID] = stateID;
    }

    getReceivableTokenIDs(): number[] {
        return Object.keys(this.receivers).map(Number);
    }

    getReceiver(tokenID: number) {
        const receiver = this.receivers[tokenID];
        if (!receiver) throw new Error(`No receiver for token ${tokenID}`);
        return receiver;
    }

    static fromConfig(path: string) {
        const receivers = JSON.parse(fs.readFileSync(path).toString());
        return new this(receivers);
    }

    dump(path: string) {
        fs.writeFileSync(path, JSON.stringify(this, null, 4));
    }
}
