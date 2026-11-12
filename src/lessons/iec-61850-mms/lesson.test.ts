import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson } from "./lesson";
import { parseScl } from "@/playground/scl";
import inverter from "./pv-inverter.cid?raw";

describe("MMS frames", () => {
    const framed = lesson.frames.filter((frame) => frame.fields?.length);
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s: TPKT counts the whole message and the BER lengths add up", (_, frame) => {
        const bytes = bytesOf(frame.fields!);
        expect(bytes.slice(0, 2)).toEqual([0x03, 0x00]);
        expect((bytes[2]! << 8) | bytes[3]!).toBe(bytes.length);
        expect(berProblems(bytes, 11)).toEqual([]);
    });

    it("answer with the float the lesson shows, most significant byte first", () => {
        const bytes = bytesOf(lesson.frames.find((frame) => frame.id === "read-resp")!.fields!);
        expect(new DataView(new Uint8Array(bytes.slice(-4)).buffer).getFloat32(0)).toBe(4820);
    });

    it("read a value the sample file describes", () => {
        const result = parseScl(inverter);
        expect(result.ok).toBe(true);
        const names = JSON.stringify(result);
        for (const name of ["PV1INV", "MMXU1", "TotW", "urcbMeas"]) expect(names).toContain(name);
    });
});
