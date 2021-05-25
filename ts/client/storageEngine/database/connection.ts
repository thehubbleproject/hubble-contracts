import level from "level";
export const db = level("./db", { valueEncoding: "json" });
