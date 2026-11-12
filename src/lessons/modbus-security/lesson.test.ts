import { describe, expect, it } from "vitest";
import { berProblems, bytesOf, fieldBytes } from "../bytes";
import english from "./en.json";
import { lesson } from "./lesson";
import certificate from "./monitoring-cert.txt?raw";

const fieldsOf = (id: string) => lesson.frames.find((frame) => frame.id === id)!.fields!;
const word = (data: readonly number[], at: number) => (data[at]! << 8) | data[at + 1]!;
/** The plain Modbus TCP frame a record carries, as its length's note writes it ("Inside … 00 01 00 …"). */
const inside = (key: keyof typeof english.fields) => {
    const hex = english.fields[key].note.match(/\b[0-9A-F]{2}(?: [0-9A-F]{2})+\b/)![0];
    return hex.split(" ").map((pair) => parseInt(pair, 16));
};

/** An OBJECT IDENTIFIER's content bytes as dotted numbers. */
function oid(bytes: readonly number[]) {
    const parts = [Math.floor(bytes[0]! / 40), bytes[0]! % 40];
    let value = 0;
    for (const byte of bytes.slice(1)) {
        value = value * 128 + (byte & 0x7f);
        if (byte & 0x80) continue;
        parts.push(value);
        value = 0;
    }
    return parts.join(".");
}

describe("the TLS ClientHello", () => {
    const hello = bytesOf(fieldsOf("client-hello"));

    it("has record and handshake lengths that count the bytes after them", () => {
        expect(hello.slice(0, 3)).toEqual([0x16, 0x03, 0x01]);
        expect(word(hello, 3)).toBe(hello.length - 5);
        expect(hello[5], "ClientHello").toBe(0x01);
        expect((hello[6]! << 16) | word(hello, 7)).toBe(hello.length - 9);
        expect(word(hello, 9), "TLS 1.2").toBe(0x0303);
        expect(fieldBytes(fieldsOf("client-hello"), "random", "random-more")).toHaveLength(32);
    });

    it("offers the cipher suite Modbus/TCP Security requires with RSA keys, and extensions whose lengths add up", () => {
        const suites = fieldBytes(fieldsOf("client-hello"), "suites");
        expect(word(suites, 0)).toBe(suites.length - 2);
        expect(word(suites, 2)).toBe(0xc02f);
        const extensions = fieldBytes(fieldsOf("client-hello"), "ext-reneg", "ext-points", "ext-groups", "groups", "ext-flags", "ext-sigalgs", "sigalgs", "sigalgs-more");
        expect(word(fieldBytes(fieldsOf("client-hello"), "ext-len"), 0)).toBe(extensions.length);
        const types: number[] = [];
        for (let at = 0; at < extensions.length; at += 4 + word(extensions, at + 2)) types.push(word(extensions, at));
        expect(types).toEqual([0xff01, 0x000b, 0x000a, 0x0016, 0x0017, 0x000d]);
        const groups = fieldBytes(fieldsOf("client-hello"), "ext-groups", "groups");
        expect(word(groups, 4)).toBe(groups.length - 6);
        expect(groups.slice(6).filter((_, i) => i % 2).includes(0x17), "P-256").toBe(true);
        const algorithms = fieldBytes(fieldsOf("client-hello"), "ext-sigalgs", "sigalgs", "sigalgs-more");
        expect(algorithms).toHaveLength(6 + 40);
        expect(word(algorithms, 2)).toBe(algorithms.length - 4);
        expect(word(algorithms, 4) / 2, "20 signature algorithms").toBe(20);
    });
});

describe("Modbus frames inside TLS records", () => {
    const records = [
        ["read-req", "len-read-req"],
        ["read-resp", "len-read-resp"],
        ["write-req", "len-write-req"],
        ["write-refused", "len-refused"],
    ] as const;

    it.each(records)("%s is a TLS 1.2 record as long as its AES-GCM nonce, its Modbus frame and its tag", (id, key) => {
        const header = bytesOf(fieldsOf(id));
        expect(header.slice(0, 3)).toEqual([0x17, 0x03, 0x03]);
        const mbap = inside(key);
        expect(word(mbap, 2), "protocol ID").toBe(0);
        expect(word(mbap, 4), "MBAP length").toBe(mbap.length - 6);
        expect(word(header, 3)).toBe(8 + mbap.length + 16);
    });

    it("carry the read, its answer, the write and the refusal the text describes", () => {
        const read = inside("len-read-req");
        expect([read[7], word(read, 8), word(read, 10)]).toEqual([0x03, 100, 2]);
        const answer = inside("len-read-resp");
        expect(new DataView(new Uint8Array([...answer.slice(11, 13), ...answer.slice(9, 11)]).buffer).getFloat32(0)).toBe(4820.5);
        const write = inside("len-write-req");
        expect([write[7], word(write, 8), word(write, 10)]).toEqual([0x06, 200, 3000]);
        const refused = inside("len-refused");
        expect(word(refused, 0), "answers the write").toBe(word(write, 0));
        expect(refused.slice(7)).toEqual([0x06 | 0x80, 0x01]);
    });
});

describe("the role extension", () => {
    const parts = lesson.anatomy!.find((anatomy) => anatomy.id === "role")!.parts;
    const bytes = bytesOf(parts);

    it("is sound DER with the Modbus role OID and a UTF8String", () => {
        expect(berProblems(bytes)).toEqual([]);
        expect(bytes[1]).toBe(bytes.length - 2);
        const id = fieldBytes(parts, "a-oid");
        expect(id[0]).toBe(0x06);
        expect(oid(id.slice(2))).toBe("1.3.6.1.4.1.50316.802.1");
        const text = fieldBytes(parts, "a-utf8", "a-role");
        expect(text[0]).toBe(0x0c);
        expect(String.fromCharCode(...text.slice(2))).toBe("Viewer");
    });

    it("is what the sample certificate prints on the lines the notes mark", () => {
        const lines = certificate.split("\n");
        expect(lines[17]!.trim()).toBe("1.3.6.1.4.1.50316.802.1:");
        expect(lines[18]!.trim()).toBe("..Viewer");
        expect(lines[16]!.trim()).toBe("TLS Web Client Authentication");
        const notes = lesson.playground!.find((item) => item.kind === "file")!;
        expect(notes.kind === "file" && notes.notes[18]).toBe("role-oid");
    });
});
