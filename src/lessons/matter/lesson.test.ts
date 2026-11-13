import { describe, expect, it } from "vitest";
import { lesson } from "./lesson";

// Verhoeff's check digit, the one Matter's manual pairing code ends with
const D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const INVERSE = [0, 4, 3, 2, 1, 5, 9, 8, 7, 6];
const verhoeff = (digits: string) => String(INVERSE[[...digits].reverse().reduce((check, digit, i) => D[check]![P[(i + 1) % 8]![Number(digit)]!]!, 0)]);
/** A full code passes when its own check digit, run through the same tables, comes to 0. */
const valid = (code: string) => [...code].reverse().reduce((check, digit, i) => D[check]![P[i % 8]![Number(digit)]!]!, 0) === 0;

/** The 11-digit manual pairing code for a passcode and a 12-bit discriminator (no vendor or product ID). */
function manualCode(passcode: number, discriminator: number) {
    const short = discriminator >> 8;
    const digits = `${short >> 2}${String(((short & 3) << 14) | (passcode & 0x3fff)).padStart(5, "0")}${String(passcode >> 14).padStart(4, "0")}`;
    return digits + verhoeff(digits);
}

describe("the Matter setup code", () => {
    it("gives the code the Matter SDK documents for its test device", () => {
        expect(manualCode(20202021, 3840)).toBe("34970112332");
    });

    it("gives 2636-002-0873 for the charger, and the anatomy is that code", () => {
        const code = manualCode(34207856, 2988);
        expect(code).toBe("26360020873");
        expect(valid(code)).toBe(true);
        expect(lesson.anatomy![0]!.parts.map(([digits]) => digits).join("")).toBe(code);
    });

    it("catches a wrong digit and two swapped digits", () => {
        expect(valid("26360020874")).toBe(false);
        expect(valid("26360020783")).toBe(false);
    });

    it("decodes back to the passcode", () => {
        const [first, middle, high] = lesson.anatomy![0]!.parts.map(([digits]) => Number(digits));
        expect(high! * 16384 + (middle! & 0x3fff)).toBe(34207856);
        expect(((first! << 2) | (middle! >> 14)) & 0xf, "short discriminator").toBe(2988 >> 8);
    });
});

describe("the currents and powers in the steps", () => {
    it("are the charger's limits at 230 V on one phase", () => {
        expect(16 * 230).toBe(3680);
        expect(6 * 230).toBe(1380);
        // The spare solar power is just enough for each limit
        expect(16 * 230).toBeLessThanOrEqual(6200 - 2500);
        expect(6 * 230).toBeLessThanOrEqual(3900 - 2500);
    });

    it("send 16 000 in the encoder, as in EnableCharging", () => {
        expect(lesson.playground![0]).toMatchObject({ kind: "encoder", type: "int32", order: "DCBA", value: 16000 });
    });
});
