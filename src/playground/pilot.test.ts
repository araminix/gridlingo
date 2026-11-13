import { describe, expect, it } from "vitest";
import { dutyFor, readingOf } from "./pilot";

describe("the control pilot's duty cycle", () => {
    it("gives the lesson's currents", () => {
        expect(readingOf(40)).toEqual({ kind: "current", amps: 24 });
        expect(readingOf(10)).toEqual({ kind: "current", amps: 6 });
        expect(readingOf(5)).toEqual({ kind: "digital" });
    });

    it("follows the rule at each end of each range", () => {
        expect(readingOf(2.9)).toEqual({ kind: "none" });
        expect(readingOf(3)).toEqual({ kind: "digital" });
        expect(readingOf(7)).toEqual({ kind: "digital" });
        expect(readingOf(7.5)).toEqual({ kind: "none" });
        expect(readingOf(8)).toEqual({ kind: "current", amps: 6 });
        expect(readingOf(85)).toEqual({ kind: "current", amps: 51 });
        expect(readingOf(90)).toEqual({ kind: "current", amps: 65 });
        expect(readingOf(96)).toEqual({ kind: "current", amps: 80 });
        expect(readingOf(97)).toEqual({ kind: "current", amps: 80 });
        expect(readingOf(98)).toEqual({ kind: "none" });
        expect(readingOf(Number.NaN)).toEqual({ kind: "none" });
    });

    it("gives the duty cycle for a current, and back", () => {
        expect(dutyFor(24)).toBe(40);
        expect(dutyFor(6)).toBe(10);
        expect(dutyFor(65)).toBe(90);
        expect(dutyFor(5)).toBeNull();
        expect(dutyFor(81)).toBeNull();
        for (const amps of [6, 16, 32, 51, 63, 80]) expect(readingOf(dutyFor(amps)!)).toEqual({ kind: "current", amps });
    });
});
