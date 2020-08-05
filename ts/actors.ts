import { Wallet } from "../scripts/helpers/interfaces";
import { ecsign, toRpcSig, toBuffer } from "ethereumjs-util";

class Actor {
    constructor(private readonly wallet: Wallet) {}

    public publicKey() {
        return this.wallet.getPublicKeyString();
    }
    public address() {
        return this.wallet.getAddressString();
    }
    public sign(signBytes: string) {
        const buffer = toBuffer(signBytes);
        const signature = ecsign(buffer, this.wallet.getPrivateKey());
        return toRpcSig(signature.v, signature.r, signature.s);
    }
    public stateLeaf(){}
    public stateIndex(){}
}

class User extends Actor {
    public send_transfer(){}
    public send_burnConsent(){}
}

class Reddit extends Actor {
    public create_publicKey(){}
    public send_createAccount(){}
    public send_airdrop(){}
    public send_burnExecution(){}
}

class Coordinator extends Actor {
    public submitBatch(){}
    public finalizeDeposit(){}
}
