import { describe, expect, it } from "vitest";
import { irigFrame, isTime } from "./irig";

const at = (hours: number, minutes: number, seconds: number) => ({ hours, minutes, seconds, day: 316, year: 26 });
const sbsOf = (cells: ReturnType<typeof irigFrame>) => [...cells.slice(80, 89), ...cells.slice(90, 98)].reduce<number>((sum, cell, i) => sum + (cell === 1 ? 2 ** i : 0), 0);

describe("an IRIG-B frame", () => {
    it("starts as the lesson's 10:41:07 frame does", () => {
        // Pr, the seconds' units 7 low bit first, the index bit, the tens 0, P1
        expect(irigFrame(at(10, 41, 7)).slice(0, 10)).toEqual(["P", 1, 1, 1, 0, 0, 0, 0, 0, "P"]);
    });

    it("has the parity of the lesson's frames", () => {
        expect(irigFrame(at(10, 41, 7))[75]).toBe(0);
        expect(irigFrame(at(10, 41, 8))[75]).toBe(0);
        // 14:12:31 has 17 ones in bits 1–74 in the lesson, with time quality 5 (two of them): 15 here, so still 1
        expect(irigFrame(at(14, 12, 31))[75]).toBe(1);
    });

    it("carries the seconds of the day in binary, and markers every ten cells", () => {
        expect(sbsOf(irigFrame(at(10, 41, 7)))).toBe(38467);
        expect(sbsOf(irigFrame(at(14, 12, 31)))).toBe(51151);
        const cells = irigFrame(at(23, 59, 59));
        for (const bit of [0, 9, 19, 29, 39, 49, 59, 69, 79, 89, 99]) expect(cells[bit]).toBe("P");
    });

    it("puts the day's hundreds and the year where the lesson says", () => {
        const cells = irigFrame(at(10, 41, 7));
        expect(cells.slice(40, 42)).toEqual([1, 1]);
        expect(cells.slice(50, 54)).toEqual([0, 1, 1, 0]);
        expect(cells.slice(55, 59)).toEqual([0, 1, 0, 0]);
    });

    it("refuses a time that does not exist", () => {
        expect(isTime(at(10, 41, 7))).toBe(true);
        expect(isTime(at(24, 0, 0))).toBe(false);
        expect(isTime({ ...at(10, 0, 0), day: 367 })).toBe(false);
    });
});
