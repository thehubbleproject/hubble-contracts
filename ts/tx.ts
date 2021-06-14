import { BigNumber } from "ethers";
import { randomNum } from "./utils";
import { float16 } from "./decimal";
import { hexZeroPad, concat, hexlify, solidityPack } from "ethers/lib/utils";
import { COMMIT_SIZE } from "./constants";
import { aggregate, SignatureInterface } from "./blsSigner";
import { solG1, solG2 } from "./mcl";
import { hashPubkey } from "./pubkey";

const stateIDLen = 4;
const nonceLen = 4;
const spokeLen = 4;

export interface Tx {
    encode(prefix?: boolean): string;
    encodeOffchain(): string;
    fee: BigNumber;
}

export interface SignableTx extends Tx {
    message(): string;
    signature?: SignatureInterface;
}

export interface OffchainTransfer {
    txType: string;
    fromIndex: number;
    toIndex: number;
    amount: BigNumber;
    fee: BigNumber;
    nonce: number;
}

export interface OffchainMassMigration {
    txType: string;
    fromIndex: number;
    amount: BigNumber;
    fee: BigNumber;
    spokeID: number;
    nonce: number;
}

export interface OffchainCreate2Transfer {
    txType: string;
    fromIndex: number;
    toIndex: number;
    toPubkeyID: number;
    amount: BigNumber;
    fee: BigNumber;
    nonce: number;
}

export function serialize(txs: Tx[]): string {
    return hexlify(concat(txs.map(tx => tx.encode())));
}

export function getAggregateSig(txs: SignableTx[]): solG1 {
    const signatures = [];
    for (const tx of txs) {
        if (!tx.signature) throw new Error(`tx has no signautre ${tx}`);
        signatures.push(tx.signature);
    }
    return aggregate(signatures).sol;
}

export class TxTransfer implements SignableTx {
    private readonly TX_TYPE = "0x01";
    public static rand(options?: { fee?: BigNumber }): TxTransfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const amount = float16.randInt();
        const fee = options?.fee ?? float16.randInt();
        const nonce = randomNum(nonceLen);
        return new TxTransfer(sender, receiver, amount, fee, nonce);
    }

    public static buildList(n: number = COMMIT_SIZE): TxTransfer[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxTransfer.rand());
        }
        return txs;
    }

    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public signature?: SignatureInterface
    ) {}

    public message(): string {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.nonce,
                this.amount,
                this.fee
            ]
        );
    }

    public encodeOffchain() {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.amount,
                this.fee,
                this.nonce
            ]
        );
    }

    public offchain(): OffchainTransfer {
        return {
            txType: this.TX_TYPE,
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            float16.compress(this.amount),
            float16.compress(this.fee)
        ]);
        return hexlify(concated);
    }
    public toString(): string {
        return `<Transfer ${this.fromIndex}->${this.toIndex} $${this.amount}  fee ${this.fee}  nonce ${this.nonce}>`;
    }
}

export class TxMassMigration implements SignableTx {
    private readonly TX_TYPE = "0x05";
    public static rand(): TxMassMigration {
        const sender = randomNum(stateIDLen);
        const amount = float16.randInt();
        const fee = float16.randInt();
        const nonce = randomNum(nonceLen);
        const spokeID = randomNum(spokeLen);
        return new TxMassMigration(sender, amount, spokeID, fee, nonce);
    }
    public static buildList(n: number = COMMIT_SIZE): TxMassMigration[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxMassMigration.rand());
        }
        return txs;
    }
    constructor(
        public readonly fromIndex: number,
        public readonly amount: BigNumber,
        public readonly spokeID: number,
        public readonly fee: BigNumber,
        public nonce: number,
        public signature?: SignatureInterface
    ) {}

    public message(): string {
        return solidityPack(
            ["uint8", "uint32", "uint256", "uint256", "uint32", "uint32"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.amount,
                this.fee,
                this.nonce,
                this.spokeID
            ]
        );
    }

    public encodeOffchain() {
        return solidityPack(
            ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.amount,
                this.fee,
                this.spokeID,
                this.nonce
            ]
        );
    }

    public offchain(): OffchainMassMigration {
        return {
            txType: this.TX_TYPE,
            fromIndex: this.fromIndex,
            amount: this.amount,
            fee: this.fee,
            spokeID: this.spokeID,
            nonce: this.nonce
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            float16.compress(this.amount),
            float16.compress(this.fee)
        ]);
        return hexlify(concated);
    }
    public toString(): string {
        return `<Migration ${this.fromIndex}->${this.spokeID} $${this.amount}  fee ${this.fee}  nonce ${this.nonce}>`;
    }
}

export class TxCreate2Transfer implements SignableTx {
    private readonly TX_TYPE = "0x03";
    public static rand(): TxCreate2Transfer {
        const sender = randomNum(stateIDLen);
        const receiver = randomNum(stateIDLen);
        const receiverPub: solG2 = ["0x00", "0x00", "0x00", "0x00"];
        const toPubkeyID = randomNum(stateIDLen);
        const amount = float16.randInt();
        const fee = float16.randInt();
        const nonce = randomNum(nonceLen);
        return new TxCreate2Transfer(
            sender,
            receiver,
            receiverPub,
            toPubkeyID,
            amount,
            fee,
            nonce
        );
    }
    public static buildList(n: number = COMMIT_SIZE): TxCreate2Transfer[] {
        const txs = [];
        for (let i = 0; i < n; i++) {
            txs.push(TxCreate2Transfer.rand());
        }
        return txs;
    }

    constructor(
        public readonly fromIndex: number,
        public readonly toIndex: number,
        public toPubkey: solG2,
        public readonly toPubkeyID: number,
        public readonly amount: BigNumber,
        public readonly fee: BigNumber,
        public nonce: number,
        public signature?: SignatureInterface
    ) {}

    public message(): string {
        return solidityPack(
            ["uint256", "uint256", "bytes32", "uint256", "uint256", "uint256"],
            [
                this.TX_TYPE,
                this.fromIndex,
                hashPubkey(this.toPubkey),
                this.nonce,
                this.amount,
                this.fee
            ]
        );
    }

    public encodeOffchain() {
        return solidityPack(
            [
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256",
                "uint256"
            ],
            [
                this.TX_TYPE,
                this.fromIndex,
                this.toIndex,
                this.toPubkeyID,
                this.amount,
                this.fee,
                this.nonce
            ]
        );
    }

    public offchain(): OffchainCreate2Transfer {
        return {
            txType: this.TX_TYPE,
            fromIndex: this.fromIndex,
            toIndex: this.toIndex,
            toPubkeyID: this.toPubkeyID,
            amount: this.amount,
            fee: this.fee,
            nonce: this.nonce
        };
    }

    public encode(): string {
        const concated = concat([
            hexZeroPad(hexlify(this.fromIndex), stateIDLen),
            hexZeroPad(hexlify(this.toIndex), stateIDLen),
            hexZeroPad(hexlify(this.toPubkeyID), stateIDLen),
            float16.compress(this.amount),
            float16.compress(this.fee)
        ]);
        return hexlify(concated);
    }
    public toString(): string {
        return `<Create2Transfer ${this.fromIndex}->${this.toIndex} (${this.toPubkeyID}) $${this.amount}  fee ${this.fee}  nonce ${this.nonce}>`;
    }
}
