// Marshals a string to an Uint8Array.
// method from https://gist.github.com/pascaldekloe/62546103a1576803dade9269ccf76330
export const encodeUTF8 = (s: string): Uint8Array => {
	var i = 0, bytes = new Uint8Array(s.length * 4);
	for (var ci = 0; ci != s.length; ci++) {
		var c = s.charCodeAt(ci);
		if (c < 128) {
			bytes[i++] = c;
			continue;
		}
		if (c < 2048) {
			bytes[i++] = c >> 6 | 192;
		} else {
			if (c > 0xd7ff && c < 0xdc00) {
				if (++ci >= s.length)
					throw new Error('UTF-8 encode: incomplete surrogate pair');
				var c2 = s.charCodeAt(ci);
				if (c2 < 0xdc00 || c2 > 0xdfff)
					throw new Error('UTF-8 encode: second surrogate character 0x' + c2.toString(16) + ' at index ' + ci + ' out of range');
				c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
				bytes[i++] = c >> 18 | 240;
				bytes[i++] = c >> 12 & 63 | 128;
			} else bytes[i++] = c >> 12 | 224;
			bytes[i++] = c >> 6 & 63 | 128;
		}
		bytes[i++] = c & 63 | 128;
	}
	return bytes.subarray(0, i);
}

export const fromHexString = (hexString: string): Uint8Array => {
    // method from https://stackoverflow.com/a/50868276
    // https://github.com/bitauth/libauth/blob/bdc1d67a3181cf6fcfe796a7b4ae36ee3f98af0a/src/lib/format/hex.ts#L37
    if (hexString.length % 2 !== 0) {
        throw new Error("Hex string should be of even length");
    }
    if (hexString.length === 0) {
        throw new Error("length can't be 0");
    }
    const regex = hexString.match(/.{1,2}/g);

    if (regex) {
        return new Uint8Array(regex.map(byte => parseInt(byte, 16)));
    } else {
        throw new Error("Can't parse string");
    }
};
