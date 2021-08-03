import { readFile, writeFile } from "fs";
import { promisify } from "util";

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

/**
 * Reads a JSON file from the provided path
 * and parses it into an object
 *
 * @param path The JSON file path
 * @returns An object of the parsed JSON file
 */
export const readJSON = async <T = any>(path: string): Promise<T> => {
    const jsonStr = await readFileAsync(path, {
        encoding: "utf8"
    });
    return JSON.parse(jsonStr);
};

/**
 * Stringifies an object and writes it
 * to the provided path.
 *
 * @param path The JSON file path
 * @param json The object to stringify and write
 * @param pretty optional Whether to pretty print
 * (newlines, 4 spaces indentation) the JSON in the file
 */
export const writeJSON = async <T = any>(
    path: string,
    json: T,
    pretty: boolean = true
): Promise<void> => {
    const jsonStr = JSON.stringify(json, null, pretty ? 4 : undefined);
    await writeFileAsync(path, jsonStr, {
        encoding: "utf8"
    });
};
