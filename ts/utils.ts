import { ethers } from "ethers";

export function randomHex(numBytes: number) {
    return ethers.utils.randomBytes(numBytes).toString();
}

export function randomNum(numBytes: number): number {
    const bytes = ethers.utils.randomBytes(numBytes);
    return ethers.utils.bigNumberify(bytes).toNumber();
}

// with zeros prepended to length bytes.
export function paddedHex(num: number, length: number): string {
    return ethers.utils.hexZeroPad(ethers.utils.hexlify(num), length);
}

export function parseEvents(receipt: any): { [key: string]: any[] } {
    const obj: { [key: string]: any[] } = {};
    receipt.events.forEach((event: any) => {
        obj[event.event] = event.args;
    });
    return obj;
}
