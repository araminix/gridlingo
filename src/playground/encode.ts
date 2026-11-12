/** Numbers to bytes and back, in the byte orders devices use. "ABCD" is the most significant byte first. */

export type NumberType = "float32" | "int16" | "uint16" | "int32" | "uint32";
export type ByteOrder = "ABCD" | "DCBA" | "BADC" | "CDAB";

export const ORDERS: readonly ByteOrder[] = ["ABCD", "DCBA", "BADC", "CDAB"];
export const TYPES: readonly NumberType[] = ["float32", "int16", "uint16", "int32", "uint32"];

export const widthOf = (type: NumberType) => (type === "int16" || type === "uint16" ? 2 : 4);

/** The positions, in the most-significant-first bytes, that each order sends first. A 2-byte value only swaps or not. */
function arrangement(order: ByteOrder, width: number): number[] {
    if (width === 2) return order === "ABCD" || order === "CDAB" ? [0, 1] : [1, 0];
    return { ABCD: [0, 1, 2, 3], DCBA: [3, 2, 1, 0], BADC: [1, 0, 3, 2], CDAB: [2, 3, 0, 1] }[order];
}

/** The bytes of a value, in the order given; null when the value does not fit the type. */
export function encode(value: number, type: NumberType, order: ByteOrder): number[] | null {
    if (!Number.isFinite(value)) return null;
    const width = widthOf(type);
    const view = new DataView(new ArrayBuffer(width));
    const whole = Math.round(value);
    switch (type) {
        case "float32":
            view.setFloat32(0, value);
            break;
        case "int16":
            if (whole < -32768 || whole > 32767) return null;
            view.setInt16(0, whole);
            break;
        case "uint16":
            if (whole < 0 || whole > 65535) return null;
            view.setUint16(0, whole);
            break;
        case "int32":
            if (whole < -2147483648 || whole > 2147483647) return null;
            view.setInt32(0, whole);
            break;
        case "uint32":
            if (whole < 0 || whole > 4294967295) return null;
            view.setUint32(0, whole);
            break;
    }
    const big = Array.from(new Uint8Array(view.buffer));
    return arrangement(order, width).map((position) => big[position]!);
}

/** The value that bytes in this order stand for; null when there are not as many bytes as the type needs. */
export function decode(bytes: readonly number[], type: NumberType, order: ByteOrder): number | null {
    const width = widthOf(type);
    if (bytes.length !== width) return null;
    const big = Array.from({ length: width }, () => 0);
    arrangement(order, width).forEach((position, i) => (big[position] = bytes[i]!));
    const view = new DataView(new Uint8Array(big).buffer);
    switch (type) {
        case "float32":
            return view.getFloat32(0);
        case "int16":
            return view.getInt16(0);
        case "uint16":
            return view.getUint16(0);
        case "int32":
            return view.getInt32(0);
        case "uint32":
            return view.getUint32(0);
    }
}

export const toHex = (bytes: readonly number[]) => bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");

/** Bytes written as hex ("71 3D 9A 40", "713d9a40"); null when it is not hex. */
export function parseHex(text: string): number[] | null {
    const clean = text.replace(/0x/gi, "").replace(/[\s,:-]/g, "");
    if (!clean || clean.length % 2 || /[^0-9a-f]/i.test(clean)) return null;
    return clean.match(/../g)!.map((pair) => parseInt(pair, 16));
}

/** A float as people write it: no more digits than a 32-bit float holds. */
export const formatFloat = (value: number) => (Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(7))));
