import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

describe("IEC 104 frames", () => {
    const framed = lesson.frames.filter((frame) => frame.fields?.length);
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s starts with 0x68 and its length counts the bytes after it", (_, frame) => {
        const bytes = bytesOf(frame.fields!);
        expect(bytes[0]).toBe(0x68);
        expect(bytes[1]).toBe(bytes.length - 2);
    });

    it("number the I-frames in order in each direction", () => {
        const sent = { scada: 0, rtu: 0 };
        for (const frame of framed) {
            const bytes = bytesOf(frame.fields!);
            if (bytes[2]! & 1) continue; // S- and U-frames carry no send number
            const from = frame.from as keyof typeof sent;
            expect((bytes[2]! | (bytes[3]! << 8)) >> 1, `${frame.id} send number`).toBe(sent[from]++);
        }
    });

    it("carry the values the lesson says, as little-endian floats", () => {
        const measured = bytesOf(lesson.frames.find((frame) => frame.id === "measured")!.fields!);
        const view = new DataView(new Uint8Array(measured).buffer);
        expect(view.getFloat32(15, true)).toBeCloseTo(4.82, 5);
        expect(view.getFloat32(23, true)).toBeCloseTo(0.61, 5);
    });
});
