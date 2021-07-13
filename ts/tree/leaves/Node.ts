import { nodeDB } from "../../client/database/connection";
import { Node } from "../hasher";

export const getNodeKey = (
    name: string,
    depth: number,
    index: number
): string => `${name}${depth}${index}`;

export class ItemNode {
    static async fromDB(
        name: string,
        depth: number,
        index: number
    ): Promise<Node> {
        const key = getNodeKey(name, depth, index);
        return nodeDB.get(key);
    }

    static async toDB(
        name: string,
        depth: number,
        index: number,
        hash: string
    ): Promise<void> {
        const key = getNodeKey(name, depth, index);
        await nodeDB.put(key, hash);
    }

    static async delete(
        name: string,
        depth: number,
        index: number
    ): Promise<void> {
        const key = getNodeKey(name, depth, index);
        await nodeDB.del(key);
    }
}
