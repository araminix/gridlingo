/**
 * Checks for the bytes in lessons, used by the lesson tests: every frame a lesson shows must be one a real device would
 * accept. Not part of the site.
 */
import type { Field } from "./types";

/** All the bytes of a frame's fields, in order. */
export const bytesOf = (fields: readonly Field[]) => fields.flatMap(([hex]) => hex.split(" ").map((pair) => parseInt(pair, 16)));

/** The bytes of the fields with these keys, in order. */
export const fieldBytes = (fields: readonly Field[], ...keys: string[]) => bytesOf(fields.filter(([, , key]) => keys.includes(key)));

/** CRC-16/MODBUS (polynomial 0xA001 reflected, start 0xFFFF): sent low byte first after the frame. */
export function crc16Modbus(bytes: readonly number[]) {
    let crc = 0xffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
    return crc;
}

/** CRC-16/DNP (polynomial 0x3D65, reflected 0xA6BC, start 0, inverted): sent low byte first after each block. */
export function crc16Dnp(bytes: readonly number[]) {
    let crc = 0;
    for (const byte of bytes) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa6bc : crc >>> 1;
    }
    return ~crc & 0xffff;
}

/** The FT 1.2 checksum of IEC 60870-5-101 and -103: the sum of the user data, modulo 256. */
export const checksum8 = (bytes: readonly number[]) => bytes.reduce((sum, byte) => (sum + byte) & 0xff, 0);

/**
 * Walks BER (ASN.1) tag-length-value encoding and checks that every length adds up: each constructed value holds
 * exactly its children. Returns the problems found, empty when the encoding is sound.
 */
export function berProblems(bytes: readonly number[], from = 0, to = bytes.length, depth = 0): string[] {
    const problems: string[] = [];
    let at = from;
    while (at < to) {
        const tag = bytes[at]!;
        let length = bytes[at + 1];
        let header = 2;
        if (length === undefined) return [...problems, `no length after tag ${tag.toString(16)} at ${at}`];
        if (length & 0x80) {
            const count = length & 0x7f;
            length = 0;
            for (let i = 0; i < count; i++) length = (length << 8) | bytes[at + 2 + i]!;
            header += count;
        }
        const end = at + header + length;
        if (end > to) return [...problems, `tag ${tag.toString(16)} at ${at} runs past its parent (${end} > ${to})`];
        if (tag & 0x20 && depth < 16) problems.push(...berProblems(bytes, at + header, end, depth + 1));
        at = end;
    }
    return problems;
}
