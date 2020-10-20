import { BigNumber } from "ethers";
import { State } from "./state";
import { TxTransfer, TxCreate2Transfer, TxMassMigration } from "./tx";
export declare class UserStateFactory {
    static buildList(numOfStates: number, initialStateID?: number, initialAccID?: number, tokenID?: number, initialBalance?: BigNumber, initialNonce?: number): State[];
}
export declare function txTransferFactory(states: State[], n?: number): TxTransfer[];
export declare function txCreate2TransferFactory(states: State[], newStates: State[], n?: number): TxCreate2Transfer[];
export declare function txMassMigrationFactory(states: State[], n?: number, spokeID?: number): TxMassMigration[];
