import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const PAIRS = [
    ["units", "units-res"],
    ["read", "read-res"],
    ["read2", "read2-res"],
] as const;
/** Value sizes of the ZCL data types used here: enum8, uint24, uint48, int24. */
const SIZE: Record<number, number> = { 0x30: 1, 0x22: 3, 0x25: 6, 0x2a: 3 };
const little = (list: number[]) => list.reduceRight((value, byte) => value * 256 + byte, 0);

/** The attribute IDs a Read Attributes request asks for. */
const asked = (list: number[]) => Array.from({ length: (list.length - 3) / 2 }, (_, i) => little(list.slice(3 + 2 * i, 5 + 2 * i)));

/** The records of a Read Attributes Response: [id, status, type, value]. */
function records(list: number[]) {
    const out: [number, number, number, number][] = [];
    let at = 3;
    while (at < list.length) {
        const [id, status, type] = [little(list.slice(at, at + 2)), list[at + 2]!, list[at + 3]!];
        const size = SIZE[type]!;
        let value = little(list.slice(at + 4, at + 4 + size));
        if (type === 0x2a && value >= 0x800000) value -= 0x1000000;
        out.push([id, status, type, value]);
        at += 4 + size;
    }
    expect(at, "the records fill the frame").toBe(list.length);
    return out;
}
const value = (id: string, attribute: number) => records(bytes(id)).find(([key]) => key === attribute)![3];

describe("the ZCL frames", () => {
    it.each(PAIRS)("%s is a global Read Attributes from client to server, answered by %s with the same sequence number", (request, response) => {
        const [question, answer] = [bytes(request), bytes(response)];
        expect(question.slice(0, 1), "frame control").toEqual([0x00]);
        expect(question[2], "Read Attributes").toBe(0x00);
        expect(answer[0], "frame control: server to client, no default response").toBe(0x18);
        expect(answer[2], "Read Attributes Response").toBe(0x01);
        expect(answer[1]).toBe(question[1]);
        const rows = records(answer);
        expect(rows.map(([id]) => id)).toEqual(asked(question));
        expect(rows.every(([, status]) => status === 0), "all SUCCESS").toBe(true);
    });

    it("gives kW, multiplier 1 and divisor 1000", () => {
        expect(asked(bytes("units"))).toEqual([0x0300, 0x0301, 0x0302]);
        expect(records(bytes("units-res")).map(([, , type, raw]) => [type, raw])).toEqual([
            [0x30, 0],
            [0x22, 1],
            [0x22, 1000],
        ]);
    });

    it("reads 4821.337 kWh and a demand of the house plus the charger: 9.348 kW at 30 A, 5.748 kW at 15 A", () => {
        const scale = (raw: number) => (raw * 1) / 1000;
        expect(scale(value("read-res", 0x0000))).toBe(4821.337);
        expect(records(bytes("read-res")).map(([, , type]) => type)).toEqual([0x25, 0x2a]);
        expect(scale(value("read-res", 0x0400))).toBe(9.348);
        expect(scale(value("read2-res", 0x0400))).toBe(5.748);
        expect(Math.round((2.148 + (30 * 240) / 1000) * 1000)).toBe(9348);
        expect(Math.round((2.148 + (15 * 240) / 1000) * 1000)).toBe(5748);
    });

    it("sends 9348 in the encoder, least significant byte first", () => {
        expect(lesson.playground![0]).toMatchObject({ kind: "encoder", type: "int32", order: "DCBA", value: 9348 });
    });
});

describe("the frame control breakdown", () => {
    it("is 0x18, bit 7 first", () => {
        expect(parseInt(lesson.anatomy![0]!.parts.map(([bits]) => bits).join(""), 2)).toBe(0x18);
    });
});
