import level from "level";
import sub from "subleveldown";

const db = level("./leveldb", { valueEncoding: "json" });

export const pubkeyDB = sub(db, "pubkey");
export const stateDB = sub(db, "state");
export const nodeDB = sub(db, "node");
