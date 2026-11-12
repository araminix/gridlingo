import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson } from "./lesson";
import { parseScl } from "@/playground/scl";
import processBus from "./process-bus.scd?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytesOfFrame = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);

/** The eight samples of a frame (4 currents in mA, 4 voltages in 10 mV) and their eight qualities. */
function samples(bytes: number[]) {
    const view = new DataView(new Uint8Array(bytes).buffer);
    const start = bytes.length - 64;
    expect(bytes.slice(start - 2, start), "seqData: tag 0x87, 64 bytes").toEqual([0x87, 0x40]);
    const values = Array.from({ length: 8 }, (_, i) => view.getInt32(start + i * 8));
    const qualities = Array.from({ length: 8 }, (_, i) => view.getUint32(start + i * 8 + 4));
    return { values, qualities };
}

describe("Sampled Values frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s has a sound header and BER encoding", (_, frame) => {
        const bytes = bytesOf(frame.fields!);
        expect(bytes.slice(0, 4), "a sampled-values multicast address").toEqual([0x01, 0x0c, 0xcd, 0x04]);
        expect(bytes.slice(12, 14), "a VLAN tag").toEqual([0x81, 0x00]);
        expect(((bytes[14]! << 8) | bytes[15]!) >> 13, "priority 4").toBe(4);
        expect(((bytes[14]! << 8) | bytes[15]!) & 0xfff, "VLAN 20").toBe(20);
        expect(bytes.slice(16, 18), "EtherType after the VLAN tag").toEqual([0x88, 0xba]);
        const appid = (bytes[18]! << 8) | bytes[19]!;
        expect(appid >= 0x4000 && appid <= 0x7fff, "an APPID of the 9-2 LE range").toBe(true);
        expect((bytes[20]! << 8) | bytes[21]!, "length from the APPID to the end").toBe(bytes.length - 18);
        expect(bytes[26], "savPdu").toBe(0x60);
        expect(berProblems(bytes, 26)).toEqual([]);
        expect(bytes.slice(28, 31), "noASDU = 1").toEqual([0x80, 0x01, 0x01]);
        expect(String.fromCharCode(...bytes.slice(37, 45)), "svID").toBe("F1MUSV01");
        expect(bytes.slice(49, 55), "confRev 1").toEqual([0x83, 0x04, 0x00, 0x00, 0x00, 0x01]);
        expect(bytes.length, "one 9-2 LE frame").toBe(124);
    });

    it("count the samples and flag the loss of sync as the lesson says", () => {
        const counters = framed.map((frame) => {
            const bytes = bytesOf(frame.fields!);
            expect(bytes.slice(45, 47), "smpCnt tag").toEqual([0x82, 0x02]);
            expect(bytes.slice(55, 57), "smpSynch tag").toEqual([0x85, 0x01]);
            return [frame.id, (bytes[47]! << 8) | bytes[48]!, bytes[57]];
        });
        expect(counters).toEqual([
            ["sv-0", 0, 1],
            ["sv-gap", 1238, 1],
            ["sv-unsync", 2650, 0],
            ["sv-fault", 3127, 0],
        ]);
        for (const [, count] of counters) expect(count as number).toBeLessThan(4000);
    });

    it("carry eight good samples whose neutrals are the sums of the phases", () => {
        for (const frame of framed) {
            const { values, qualities } = samples(bytesOf(frame.fields!));
            expect(qualities, `${frame.id}: all good`).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
            expect(values[3], `${frame.id}: IN = IA + IB + IC`).toBe(values[0]! + values[1]! + values[2]!);
            expect(values[7], `${frame.id}: VN = VA + VB + VC`).toBe(values[4]! + values[5]! + values[6]!);
        }
    });

    it("decode to the values the texts and the table give", () => {
        const first = samples(bytesOfFrame("sv-0")).values;
        expect(first.slice(0, 4).map((mA) => mA / 1000)).toEqual([531.57, -433.34, -98.23, 0]);
        expect(first.slice(4).map((count) => count / 100)).toEqual([28169.13, -14084.57, -14084.56, 0]);
        // Phase A at the top of its wave: the peak of 34.5 kV phase-to-phase
        expect(first[4]! / 100).toBeCloseTo((34500 / Math.sqrt(3)) * Math.SQRT2, 1);

        const fault = samples(bytesOfFrame("sv-fault")).values;
        expect(fault.slice(0, 4).map((mA) => mA / 1000)).toEqual([-3796.732, -83.614, 526.324, -3354.022]);
        expect(Math.abs(fault[0]!) / 1000, "within the peak of 2.8 kA rms").toBeLessThanOrEqual(2800 * Math.SQRT2);
        expect(Math.abs(fault[4]!), "VA fell to a quarter of its peak").toBeLessThan(first[4]! / 4);

        const ia = lesson.points!.rows.find((row) => row.id === "ia")!;
        for (const id of ["sv-0", "sv-gap", "sv-unsync", "sv-fault"]) {
            const frame = lesson.frames.find((item) => item.id === id)!;
            const shown = ia.values.find(([step]) => step === frame.step)![1];
            expect(shown, `${id}: IA in the table`).toBe(`${(samples(bytesOfFrame(id)).values[0]! / 1000).toFixed(2)} A`);
        }
    });

    it("send the frames 250 µs apart, 80 to a 50 Hz cycle", () => {
        const frames = lesson.timing!.tracks.find((track) => track.id === "frames")!.events!;
        expect(frames.map((event) => event.t).slice(0, 3)).toEqual([0, 0.25, 0.5]);
        expect(frames.at(-1)!.t, "one cycle: 20 ms").toBe(20);
        expect(frames).toHaveLength(81);
    });

    it("stream what the sample file describes", () => {
        const result = parseScl(processBus);
        expect(result.ok).toBe(true);
        const names = JSON.stringify(result);
        for (const name of ["F1MU", "MSVCB01", "PhsMeas1", "TCTR1", "01-0C-CD-04-00-01", "APPID 4000", "F1PROT"]) expect(names).toContain(name);
        expect(processBus).toContain('smvID="F1MUSV01"');
    });
});
