import { describe, expect, it } from "vitest";
import { bytesOf, crc16Dnp } from "../bytes";
import type { Field } from "../types";
import { lesson } from "./lesson";
import settings from "./outstation.json?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const le = (bytes: readonly number[], at: number, size: number) => bytes.slice(at, at + size).reduceRight((value, byte) => value * 256 + byte, 0);

/**
 * Checks a link frame the way a receiver does: start, length, the header CRC and the CRC after every 16-byte block.
 * Returns the user data (transport and application layers) and where the CRC bytes are.
 */
function unframe(bytes: readonly number[]) {
    expect(bytes.slice(0, 2), "start").toEqual([0x05, 0x64]);
    const size = bytes[2]! - 5;
    const crcAt = new Set([8, 9]);
    expect(le(bytes, 8, 2), "header CRC").toBe(crc16Dnp(bytes.slice(0, 8)));
    const data: number[] = [];
    let at = 10;
    for (let left = size; left > 0; left -= 16) {
        const block = bytes.slice(at, at + Math.min(16, left));
        at += block.length;
        expect(le(bytes, at, 2), `CRC of the block at ${at - block.length}`).toBe(crc16Dnp(block));
        crcAt.add(at).add(at + 1);
        data.push(...block);
        at += 2;
    }
    expect(at, "nothing after the last CRC").toBe(bytes.length);
    return { control: bytes[3]!, dest: le(bytes, 4, 2), src: le(bytes, 6, 2), data, crcAt };
}

/** Where each field starts, and how many bytes it has. */
function offsets(fields: readonly Field[]) {
    let at = 0;
    return fields.map(([hex]) => {
        const size = hex.split(" ").length;
        at += size;
        return [at - size, size] as const;
    });
}

describe("DNP3 frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s: every CRC matches, and the fields named CRC are exactly the CRC bytes", (_, frame) => {
        const bytes = bytesOf(frame.fields!);
        const { crcAt } = unframe(bytes);
        offsets(frame.fields!).forEach(([at, size], i) => {
            const isCrc = frame.fields![i]![2].startsWith("crc");
            for (let b = at; b < at + size; b++) expect(crcAt.has(b), `${frame.fields![i]![2]} at byte ${b}`).toBe(isCrc);
        });
    });

    it("go from master 1 to outstation 10 and back, with the direction bit set by the master", () => {
        for (const frame of framed) {
            const { control, dest, src } = unframe(bytesOf(frame.fields!));
            const fromMaster = frame.from === "scada";
            expect([control, dest, src], frame.id).toEqual(fromMaster ? [0xc4, 10, 1] : [0x44, 1, 10]);
        }
    });

    it("send one transport segment each, counted per direction", () => {
        const next = { scada: 0, rtu: 0 };
        for (const frame of framed) {
            const transport = unframe(bytesOf(frame.fields!)).data[0]!;
            expect(transport & 0xc0, `${frame.id}: FIR and FIN`).toBe(0xc0);
            expect(transport & 0x3f, `${frame.id}: transport sequence`).toBe(next[frame.from as keyof typeof next]++);
        }
    });

    it("answer each request with its sequence number, and confirm the unsolicited one with UNS set", () => {
        const app = (id: string) => unframe(bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!)).data.slice(1);
        const control = (id: string) => app(id)[0]!;
        expect(control("response") & 0x0f).toBe(control("read") & 0x0f);
        expect(control("null") & 0x0f).toBe(control("enable") & 0x0f);
        expect(control("enable") & 0x0f, "the next request").toBe((control("read") + 1) & 0x0f);
        expect(control("response") & 0x20, "no confirm without events").toBe(0);
        expect(control("unsolicited") & 0x30, "CON and UNS").toBe(0x30);
        expect(control("confirm") & 0x1f, "UNS and the same sequence").toBe(0x10 | (control("unsolicited") & 0x0f));
        expect(["read", "response", "enable", "null", "unsolicited", "confirm"].map((id) => app(id)[1])).toEqual([0x01, 0x81, 0x14, 0x81, 0x82, 0x00]);
    });

    it("carry the values and times the text gives", () => {
        const response = unframe(bytesOf(lesson.frames.find((frame) => frame.id === "response")!.fields!)).data.slice(1);
        expect(response.slice(4, 11), "g1v2, points 0 and 1: closed, no trip").toEqual([0x01, 0x02, 0x00, 0x00, 0x01, 0x81, 0x01]);
        expect(response.slice(11, 16), "g30v2, point 0").toEqual([0x1e, 0x02, 0x00, 0x00, 0x00]);
        expect(response[16], "online").toBe(0x01);
        expect(le(response, 17, 2)).toBe(11050);

        const events = unframe(bytesOf(lesson.frames.find((frame) => frame.id === "unsolicited")!.fields!)).data.slice(1);
        expect(events.slice(4, 8), "g2v2, count 2, index prefix").toEqual([0x02, 0x02, 0x17, 0x02]);
        const event = (at: number) => ({ index: events[at], state: events[at + 1]! >> 7, time: new Date(le(events, at + 2, 6)).toISOString() });
        expect([event(8), event(16)]).toEqual([
            { index: 1, state: 1, time: "2026-11-12T10:41:07.230Z" },
            { index: 0, state: 0, time: "2026-11-12T10:41:07.280Z" },
        ]);
    });

    it("take apart the control byte the unsolicited response sends", () => {
        const bits = lesson.anatomy![0]!.parts.map(([text]) => text).join("");
        expect(parseInt(bits, 2)).toBe(unframe(bytesOf(lesson.frames.find((frame) => frame.id === "unsolicited")!.fields!)).data[1]);
    });

    it("match the sample settings", () => {
        const file = JSON.parse(settings);
        expect(file.link).toMatchObject({ outstation: 10, master: 1, tcpPort: 20000 });
        expect(file.binaryInputs.map((point: { index: number; static: string; event: string }) => [point.index, point.static, point.event])).toEqual([
            [0, "g1v2", "g2v2"],
            [1, "g1v2", "g2v2"],
        ]);
        expect(file.analogInputs[0]).toMatchObject({ index: 0, static: "g30v2", unit: "V" });
    });
});
