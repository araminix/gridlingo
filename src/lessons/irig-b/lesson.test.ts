import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import type { Field } from "../types";
import { lesson } from "./lesson";

const MARKERS = [0, 9, 19, 29, 39, 49, 59, 69, 79, 89, 99];
const fields = (id: string) => lesson.frames.find((frame) => frame.id === id)!.fields!;
const value = (list: readonly Field[], key: string) => bytesOf(list.filter(([, , k]) => k.startsWith(key)));
/** Two BCD digits in one byte, as the lesson shows them: 0x41 → 41. */
const bcd = (byte: number) => (byte >> 4) * 10 + (byte & 0x0f);

/** The 100 bits of a frame, built from its fields at the places IRIG-B gives them; markers are "P". */
function bitsOf(list: readonly Field[]) {
    const bits: (0 | 1 | "P")[] = Array.from({ length: 100 }, (_, i) => (MARKERS.includes(i) ? "P" : 0));
    const put = (at: readonly number[], number: number) => at.forEach((position, i) => (bits[position] = ((number >> i) & 1) as 0 | 1));
    const [s, m, h] = ["sec", "min", "hour"].map((key) => value(list, key)[0]!);
    const [hundreds, tensUnits] = value(list, "day");
    put([1, 2, 3, 4], s! & 0x0f);
    put([6, 7, 8], s! >> 4);
    put([10, 11, 12, 13], m! & 0x0f);
    put([15, 16, 17], m! >> 4);
    put([20, 21, 22, 23], h! & 0x0f);
    put([25, 26], h! >> 4);
    put([30, 31, 32, 33], tensUnits! & 0x0f);
    put([35, 36, 37, 38], tensUnits! >> 4);
    put([40, 41], hundreds!);
    const year = value(list, "year")[0]!;
    put([50, 51, 52, 53], year & 0x0f);
    put([55, 56, 57, 58], year >> 4);
    put([60, 61, 62, 63], value(list, "cf-flags")[0]!);
    put([64, 65, 66, 67, 68, 70], value(list, "cf-offset")[0]!);
    put([71, 72, 73, 74], value(list, "tq")[0]!);
    put([75], value(list, "parity")[0]!);
    const [high, low] = value(list, "sbs");
    put([80, 81, 82, 83, 84, 85, 86, 87, 88, 90, 91, 92, 93, 94, 95, 96, 97], (high! << 8) | low!);
    return { bits, seconds: bcd(h!) * 3600 + bcd(m!) * 60 + bcd(s!), day: bcd(hundreds!) * 100 + bcd(tensUnits!) };
}

const framed = lesson.frames.filter((frame) => frame.fields?.length);

describe("IRIG-B frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s holds valid BCD digits, and every group fits its bits", (_, frame) => {
        for (const [hex, , key] of frame.fields!) {
            if (key.startsWith("sbs") || key.startsWith("parity") || key.startsWith("tq") || key.startsWith("cf")) continue;
            for (const byte of bytesOf([[hex, "time", key]])) expect([byte >> 4, byte & 0x0f].every((digit) => digit <= 9), `${key}: ${hex}`).toBe(true);
        }
        const { seconds, day } = bitsOf(frame.fields!);
        expect(seconds).toBeLessThan(86400);
        expect(day).toBe(316);
        expect(new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10), "day 316 of 2026").toBe("2026-11-12");
    });

    it.each(framed.map((frame) => [frame.id, frame] as const))("%s has even parity over bits 1 to 75, and SBS counts the seconds of the day", (_, frame) => {
        const { bits, seconds } = bitsOf(frame.fields!);
        const ones = bits.slice(1, 76).filter((bit) => bit === 1).length;
        expect(ones % 2, "even parity").toBe(0);
        const [high, low] = value(frame.fields!, "sbs");
        expect((high! << 8) | low!, "straight binary seconds").toBe(seconds);
    });

    it("count one second per frame, and say what the text says", () => {
        const [f07, f08, hold] = ["f07", "f08", "f-hold"].map((id) => bitsOf(fields(id)).seconds);
        expect(f07).toBe(10 * 3600 + 41 * 60 + 7);
        expect(f08! - f07!).toBe(1);
        expect(hold).toBe(14 * 3600 + 12 * 60 + 31);
        expect(value(fields("f07"), "tq")).toEqual([0]);
        expect(value(fields("f-hold"), "tq"), "time quality 5: within 10 µs").toEqual([5]);
        expect(bitsOf(fields("f-hold")).bits.slice(1, 75).filter((bit) => bit === 1).length, "17 ones before the parity bit").toBe(17);
    });

    it("draw the first bits of the 10:41:07 frame with the right pulse widths", () => {
        const { bits } = bitsOf(fields("f07"));
        const cells = [bits[99]!, ...bits.slice(0, 10)];
        const width = (bit: 0 | 1 | "P") => (bit === "P" ? 8 : bit === 1 ? 5 : 2);
        const [, dc, am] = lesson.timing!.tracks;
        // DC level shift: high at the start of each 10 ms cell, low after the pulse
        expect(dc!.signal).toEqual(cells.flatMap((bit, i) => [[i * 10, 1], [i * 10 + width(bit), 0]]));
        // 1 kHz carrier: one cycle per ms, loud during the pulse, about 10:3 louder than the rest
        const am1 = am!.signal!;
        expect(am1).toHaveLength(cells.length * 10 * 2);
        cells.forEach((bit, i) => {
            for (let ms = 0; ms < 10; ms++) {
                const [[t, up], [, down]] = [am1[(i * 10 + ms) * 2]!, am1[(i * 10 + ms) * 2 + 1]!];
                expect(t).toBe(i * 10 + ms);
                expect(((up - down) / 2).toFixed(2), `cell ${i} ms ${ms}`).toBe(ms < width(bit) ? "0.50" : "0.15");
            }
        });
        // The ruler names each cell, and puts the on-time mark on Pr at 10 ms
        const ruler = lesson.timing!.tracks[0]!.events!;
        expect(ruler.map((event) => event.t)).toEqual(cells.map((_, i) => i * 10));
        expect(ruler.map((event) => event.label)).toEqual(["p0", "on-time", "one", "one", "one", "zero", "zero", "zero", "zero", "zero", "p1"]);
    });
});
