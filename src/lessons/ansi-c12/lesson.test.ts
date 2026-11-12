import { describe, expect, it } from "vitest";
import { bytesOf, checksum8 } from "../bytes";
import { lesson } from "./lesson";
import tables from "./tables.txt?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
/** The data of a C12.18 packet: what follows the 6-byte header (the CRC is not in the lesson). */
const data = (id: string) => bytes(id).slice(6);
const text = (list: readonly number[]) => String.fromCharCode(...list);

describe("ANSI C12.18 packets", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s starts with 0xEE and its length counts the data", (_, frame) => {
        const list = bytesOf(frame.fields!);
        expect(list[0], "STP").toBe(0xee);
        expect(list[1], "identity").toBe(0x00);
        expect(list[2]! & ~0x20, "control: only the toggle bit").toBe(0x00);
        expect(list[3], "sequence number: a single packet").toBe(0);
        expect((list[4]! << 8) | list[5]!).toBe(list.length - 6);
    });

    it("flip the toggle bit with each new packet from the same side", () => {
        for (const side of ["laptop", "meter"]) {
            // The meter's first answer (Identification) is told in words; it carried toggle 0
            const toggles = lesson.frames.filter((frame) => frame.from === side && frame.fields).map((frame) => (bytesOf(frame.fields!)[2]! & 0x20) >> 5);
            const first = side === "laptop" ? 0 : 1;
            expect(toggles, side).toEqual(toggles.map((_, i) => (first + i) % 2));
        }
    });

    it("use the C12.18 service codes, with their parameters", () => {
        expect(data("ident")).toEqual([0x20]);
        const logon = data("logon");
        expect(logon[0]).toBe(0x50);
        expect((logon[1]! << 8) | logon[2]!, "user ID").toBe(2);
        expect(text(logon.slice(3)), "user, 10 bytes").toBe("TECH01    ");
        const security = data("security");
        expect(security[0]).toBe(0x51);
        expect(text(security.slice(1)), "password, 20 bytes").toBe("tech2026".padEnd(20, " "));
        expect(data("read")).toEqual([0x30, 0x00, 23]);
        expect(data("logoff")).toEqual([0x52]);
        expect(data("terminate")).toEqual([0x21]);
        for (const id of ["logon-ok", "security-ok", "logoff-ok", "terminate-ok"]) expect(data(id), id).toEqual([0x00]);
    });

    it("answer table 23 with OK, a count, the data and a checksum that adds up to 0", () => {
        const [ok, high, low, ...rest] = data("table");
        const table = rest.slice(0, -1);
        expect(ok).toBe(0x00);
        expect((high! << 8) | low!).toBe(table.length);
        expect(checksum8([...table, rest.at(-1)!])).toBe(0);
        // Two INT48 summations, low byte first
        const int48 = (list: readonly number[]) => list.reduceRight((value, byte) => value * 256 + byte, 0);
        expect([int48(table.slice(0, 6)), int48(table.slice(6, 12))]).toEqual([12345678, 123456]);
    });

    it("list the tables with their ids, manufacturer tables from 2048", () => {
        const rows = tables
            .split("\n")
            .filter((row) => /^(ST|MT) /.test(row))
            .map((row) => row.match(/^(ST|MT) (\d+)\s+0x([0-9A-F]{4})/)!);
        expect(rows.length).toBeGreaterThan(5);
        for (const [, kind, number, id] of rows) expect(parseInt(id!, 16), `${kind} ${number}`).toBe(Number(number) + (kind === "MT" ? 2048 : 0));
        expect(tables).toContain("ST 23    0x0017");
    });
});
