import _ from "lodash";
import { PubkeyLeafFactory } from "../../tree/leaves/PubkeyLeaf";
import { pubkey2statesDB } from "./connection";

export class Pubkey2StatesDB {
    static async getStates(pubkeyHash: string): Promise<number[]> {
        return JSON.parse(await pubkey2statesDB.get(pubkeyHash));
    }

    static async update(pubkeyID: number, stateID: number): Promise<void> {
        const pubkeyLeaf = await PubkeyLeafFactory().fromDB(pubkeyID);
        const pubkeyHash = pubkeyLeaf.item.hash();

        try {
            const states: string = await pubkey2statesDB.get(pubkeyHash);
            const appended = _.union<number>(JSON.parse(states), [stateID]);
            await pubkey2statesDB.put(pubkeyHash, JSON.stringify(appended));
        } catch (error) {
            if (error.name === "NotFoundError") {
                await pubkey2statesDB.put(
                    pubkeyHash,
                    JSON.stringify([stateID])
                );
            } else {
                throw error;
            }
        }
    }
}
