import level from "level";
import sub from "subleveldown";

const db = level("./leveldb", { valueEncoding: "json" });

export const close = async (): Promise<void> => {
    await db.close();
};

export const pubkeyDB = sub(db, "pubkey");
export const stateDB = sub(db, "state");
export const nodeDB = sub(db, "node");
// export const batchDB = sub(db, "batch");
export const txDB = sub(db, "tx");
export const pubkey2statesDB = sub(db, "pubkey2states");
