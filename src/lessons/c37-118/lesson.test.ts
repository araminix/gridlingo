import { describe, expect, it } from "vitest";
import { bytesOf, fieldBytes } from "../bytes";
import type { Frame } from "../types";
import { lesson } from "./lesson";

/** CRC-CCITT as C37.118 uses it: polynomial 0x1021, start 0xFFFF, not reflected, no final XOR (CRC-16/CCITT-FALSE). */
function crcCcitt(bytes: readonly number[]) {
    let crc = 0xffff;
    for (const byte of bytes) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc;
}

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const view = (item: Frame) => new DataView(new Uint8Array(bytesOf(item.fields!)).buffer);
const degrees = (radians: number) => (radians * 180) / Math.PI;
const TIME_BASE = 1_000_000;

describe("C37.118 frames", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);

    it("compute the CRC-CCITT check value", () => {
        expect(crcCcitt([..."123456789"].map((char) => char.charCodeAt(0)))).toBe(0x29b1);
    });

    it.each(framed.map((item) => [item.id, item] as const))("%s: SYNC, FRAMESIZE and CHK are right", (_, item) => {
        const bytes = bytesOf(item.fields!);
        expect(bytes[0]).toBe(0xaa);
        expect(bytes[1]! >> 4, "frame type").toBe({ Command: 4, "CFG-2": 3, Data: 0 }[item.kind]);
        expect(bytes[1]! & 0x0f, "version").toBe(1);
        expect((bytes[2]! << 8) | bytes[3]!, "FRAMESIZE counts the whole frame").toBe(bytes.length);
        expect((bytes[4]! << 8) | bytes[5]!, "IDCODE").toBe(7);
        expect((bytes.at(-2)! << 8) | bytes.at(-1)!, "CHK").toBe(crcCcitt(bytes.slice(0, -2)));
    });

    it("stamp each frame with the time the lesson gives, from a clock locked to UTC", () => {
        const start = Date.UTC(2026, 10, 12, 10, 41, 6, 950);
        for (const item of framed) {
            const data = view(item);
            const stamp = data.getUint32(6) * 1000 + ((data.getUint32(10) & 0xffffff) / TIME_BASE) * 1000;
            expect(data.getUint8(10), `${item.id} time quality`).toBe(0);
            const sent = start + Number(item.time) * 1000;
            // Commands and configuration leave when they are stamped; data frames 30 ms after their measurement
            expect(Math.round(sent - stamp), `${item.id} stamped`).toBe(item.kind === "Data" ? 30 : 0);
        }
    });

    it("send commands 5 (send CFG-2) and 2 (data on)", () => {
        expect(view(frame("cmd-cfg")).getUint16(14)).toBe(5);
        expect(view(frame("cmd-on")).getUint16(14)).toBe(2);
    });

    it("describe in CFG-2 exactly the data frames that follow", () => {
        const cfg = view(frame("cfg2"));
        expect(cfg.getUint32(14), "TIME_BASE").toBe(TIME_BASE);
        expect(cfg.getUint16(18), "NUM_PMU").toBe(1);
        const ascii = (from: number) => String.fromCharCode(...new Uint8Array(cfg.buffer, from, 16));
        expect(ascii(20)).toBe("ALPHA PMU1      ");
        expect(cfg.getUint16(36), "IDCODE of the PMU").toBe(7);
        const format = cfg.getUint16(38);
        expect(format & 0b1011, "polar float phasors, float FREQ/DFREQ").toBe(0b1011);
        const [phasors, analogs, digitals] = [cfg.getUint16(40), cfg.getUint16(42), cfg.getUint16(44)];
        expect([phasors, analogs, digitals]).toEqual([2, 0, 0]);
        expect([ascii(46), ascii(62)]).toEqual(["V1 POS SEQ      ", "I1 POS SEQ      "]);
        expect([cfg.getUint8(78), cfg.getUint8(82)], "PHUNIT: a voltage, then a current").toEqual([0, 1]);
        expect(cfg.getUint16(86) & 1, "FNOM: 50 Hz").toBe(1);
        expect(cfg.getUint16(88), "CFGCNT").toBe(3);
        expect(cfg.getInt16(90), "DATA_RATE").toBe(50);
        const names = 16 * (phasors + analogs + 16 * digitals);
        expect(cfg.byteLength, "CFG-2 size from its counts").toBe(14 + 4 + 2 + 16 + 2 + 2 + 6 + names + 4 * (phasors + analogs + digitals) + 2 + 2 + 2 + 2);
        for (const id of ["data-0", "data-20", "data-event"]) {
            // STAT, two polar float phasors, float FREQ and DFREQ
            expect(view(frame(id)).byteLength, `${id} size from CFG-2`).toBe(14 + 2 + phasors * 8 + 4 + 4 + 4 * analogs + 2 * digitals + 2);
        }
    });

    it("carry the phasors and frequency the lesson shows, most significant byte first", () => {
        const values = (id: string) => {
            const data = view(frame(id));
            return { stat: data.getUint16(14), v: data.getFloat32(16), va: degrees(data.getFloat32(20)), i: data.getFloat32(24), ia: degrees(data.getFloat32(28)), f: data.getFloat32(32), df: data.getFloat32(36) };
        };
        const first = values("data-0");
        expect(first.stat).toBe(0);
        expect(first.v).toBe(89120);
        expect(first.va).toBeCloseTo(-12.4, 4);
        expect(first.i).toBe(412);
        expect(first.ia).toBeCloseTo(-31.2, 4);
        expect(first.f).toBeCloseTo(50.02, 5);
        expect(first.df).toBe(0);

        const next = values("data-20");
        expect(next.v).toBe(89118);
        expect(next.va).toBeCloseTo(-12.256, 4);
        expect(next.i).toBeCloseTo(412.3, 4);
        expect(next.ia).toBeCloseTo(-31.056, 4);
        // At 50.020 Hz the phasor turns 0.020 turns a second faster than the reference: 0.144° in 20 ms
        const turn = 360 * (first.f - 50) * 0.02;
        expect(next.va - first.va).toBeCloseTo(turn, 3);
        expect(next.ia - first.ia).toBeCloseTo(turn, 3);
        expect(view(frame("data-20")).getUint32(10) - view(frame("data-0")).getUint32(10), "20 ms apart").toBe(0.02 * TIME_BASE);

        const event = values("data-event");
        expect(event.v).toBe(88870);
        expect(event.va).toBeCloseTo(-15.62, 4);
        expect(event.i).toBe(455);
        expect(event.ia).toBeCloseTo(-27.9, 4);
        expect(event.f).toBeCloseTo(49.946, 5);
        expect(event.df).toBeCloseTo(-0.12, 6);
    });

    it("show the same frequency field in both stream frames", () => {
        expect(fieldBytes(frame("data-0").fields!, "freq")).toEqual(fieldBytes(frame("data-20").fields!, "freq"));
    });
});
