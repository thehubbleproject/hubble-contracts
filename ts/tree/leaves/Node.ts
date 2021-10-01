import { Node } from "../hasher";
import { LevelUp } from "levelup";

export const getNodeKey = (
    name: string,
    depth: number,
    index: number
): string => `${name}${depth}${index}`;

export class ItemNode {
    static async fromDB(
        nodeDB: LevelUp,
        name: string,
        depth: number,
        index: number
    ): Promise<Node> {
        const key = getNodeKey(name, depth, index);
        return nodeDB.get(key);
    }

    static async toDB(
        nodeDB: LevelUp,
        name: string,
        depth: number,
        index: number,
        hash: string
    ): Promise<void> {
        const key = getNodeKey(name, depth, index);
        await nodeDB.put(key, hash);
    }

    static async delete(
        nodeDB: LevelUp,
        name: string,
        depth: number,
        index: number
    ): Promise<void> {
        const key = getNodeKey(name, depth, index);
        await nodeDB.del(key);
    }
}
