import { describe, expect, it } from "vitest";
import { encode } from "@/playground/encode";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";
import registers from "./register-map.csv?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const word = (data: number[], at: number) => (data[at]! << 8) | data[at + 1]!;
/** A 32-bit float sent low word first (CDAB): the second register holds the high half. */
const cdab = (data: number[], at: number) => new DataView(new Uint8Array([...data.slice(at + 2, at + 4), ...data.slice(at, at + 2)]).buffer).getFloat32(0);

describe("Modbus TCP frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s has an MBAP header whose length counts the unit ID and the PDU", (_, frame) => {
        const data = bytesOf(frame.fields!);
        expect(word(data, 2), "protocol ID").toBe(0);
        expect(word(data, 4), "length").toBe(data.length - 6);
        expect(data[6], "unit ID").toBe(1);
    });

    it("answer each request with its transaction ID, in order", () => {
        const pairs = [
            ["read-req", "read-resp"],
            ["write-req", "write-resp"],
            ["check-req", "check-resp"],
            ["wrong-req", "exception"],
        ];
        pairs.forEach(([request, response], i) => {
            expect(word(bytes(request!), 0)).toBe(i + 1);
            expect(word(bytes(response!), 0)).toBe(i + 1);
        });
    });

    it("read the float the text says, low word first, with a byte count that matches", () => {
        for (const [id, value] of [
            ["read-resp", 4820.5],
            ["check-resp", 2998.7],
        ] as const) {
            const data = bytes(id);
            expect(data[7]).toBe(0x03);
            expect(data[8], "byte count").toBe(data.length - 9);
            expect(cdab(data, 9)).toBeCloseTo(value, 2);
        }
        expect(bytes("read-resp").slice(9)).toEqual(encode(4820.5, "float32", "CDAB"));
    });

    it("send the wire address, 0-based, of the manual's register numbers", () => {
        expect(word(bytes("read-req"), 8)).toBe(40101 - 40001);
        expect(word(bytes("write-req"), 8)).toBe(40201 - 40001);
        expect(word(bytes("write-req"), 10)).toBe(3000);
        expect(word(bytes("wrong-req"), 8)).toBe(40101);
    });

    it("echo a write, and mark an exception with the high bit of the function code", () => {
        expect(bytes("write-resp")).toEqual(bytes("write-req"));
        const exception = bytes("exception");
        expect(exception[7]).toBe(bytes("wrong-req")[7]! | 0x80);
        expect(exception[8], "illegal data address").toBe(0x02);
    });

    it("use the addresses the register map gives", () => {
        const rows = registers.split("\n").filter((line) => /^\d/.test(line)).map((line) => line.split(","));
        for (const [register, address] of rows) expect(Number(address)).toBe(Number(register) - 40001);
        const addressOf = (name: string) => Number(rows.find((row) => row[2] === name)![1]);
        expect(word(bytes("read-req"), 8)).toBe(addressOf("Active power"));
        expect(word(bytes("write-req"), 8)).toBe(addressOf("Active power limit"));
    });
});
