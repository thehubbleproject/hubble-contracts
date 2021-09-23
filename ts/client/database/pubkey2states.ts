import _ from "lodash";
import { PubkeyLeafFactory } from "../../tree/leaves/PubkeyLeaf";
import { LevelUp } from "levelup";

export class Pubkey2StatesDB {
    static async getStates(
        pubkeyHash: string,
        pubkey2statesDB: LevelUp
    ): Promise<number[]> {
        return JSON.parse(await pubkey2statesDB.get(pubkeyHash));
    }

    static async update(
        pubkeyID: number,
        stateID: number,
        pubkey2statesDB: LevelUp,
        pubkeyDB: LevelUp
    ): Promise<void> {
        const pubkeyLeaf = await PubkeyLeafFactory(pubkeyDB).fromDB(pubkeyID);
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
