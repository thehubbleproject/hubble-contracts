export const DUMMY_ADDRESS = '0x19198ec2f57cc15c381b461b00000000451c8f71';
export const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
export const DUMMY_BYTES = '0xaac98d66b1823c5468711111167a556d79100e63c591c76f8caf8654444b4100';

export function rand32() {
  return web3.utils.randomHex(32);
}

export function randAdr() {
  return web3.utils.randomHex(20);
}
