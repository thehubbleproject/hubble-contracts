import level from "level";
import sub from "subleveldown";
import { LevelUp } from "levelup";

import { mkdir, stat } from "fs";
import { promisify } from "util";

const mkdirAsync = promisify(mkdir);
const existsAsync = promisify(stat);

export class Connection {
    public readonly pubkeyDB: LevelUp;
    public readonly stateDB: LevelUp;
    public readonly txDB: LevelUp;
    public readonly pubkey2statesDB: LevelUp;

    private db: LevelUp;

    constructor(path: string) {
        this.db = level(`${path}`, { valueEncoding: "json" });

        this.pubkeyDB = sub(this.db, "pubkey");
        this.stateDB = sub(this.db, "state");
        this.txDB = sub(this.db, "tx");
        this.pubkey2statesDB = sub(this.db, "pubkey2states");
    }

    public static async create(path: string) {
        try {
            await existsAsync(path);
        } catch (error) {
            await mkdirAsync(path, { recursive: true });
        }

        return new Connection(path);
    }

    public async close(): Promise<void> {
        await this.db.close();
    }
}
