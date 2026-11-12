import { describe, expect, it } from "vitest";
import text from "./en.json";
import { lesson } from "./lesson";

/** The current a duty cycle offers (IEC 61851-1, Annex A): duty × 0.6 A up to 85 %, then (duty − 64) × 2.5 A up to 96 %. */
function currentOf(duty: number) {
    if (duty >= 10 && duty <= 85) return duty * 0.6;
    if (duty > 85 && duty <= 96) return (duty - 64) * 2.5;
    throw new Error(`${duty} % offers no current`);
}

/** The voltage on CP: +12 V through 1 kΩ, into the car's resistance behind a diode of about 0.7 V. */
const cpVolts = (car: number) => 12 - (1000 * (12 - 0.7)) / (1000 + car);
const parallel = (a: number, b: number) => (a * b) / (a + b);

const track = (id: string) => lesson.timing!.tracks.find((item) => item.id === id)!;

/** The share of each 1 ms period a track spends above −12 V, in percent. */
function dutyOf(id: string) {
    const signal = track(id).signal!;
    const high = signal.reduce((sum, [t, level], i) => sum + (level > 0 ? (signal[i + 1]?.[0] ?? lesson.timing!.end) - t : 0), 0);
    return Math.round((high / lesson.timing!.end) * 1000) / 10;
}

describe("the control pilot", () => {
    it("offers the currents the lesson says", () => {
        expect(currentOf(40)).toBeCloseTo(24, 9);
        expect(currentOf(10)).toBeCloseTo(6, 9);
        expect(currentOf(85)).toBeCloseTo(51, 9);
        expect(currentOf(96)).toBeCloseTo(80, 9);
        expect(currentOf(20 / 0.6)).toBeCloseTo(20, 9);
        expect(() => currentOf(5)).toThrow();
        for (const frame of lesson.frames.filter((item) => item.name.startsWith("PWM"))) {
            const [, duty, amps] = frame.name.match(/(\d+) % → (\d+) A/)!;
            expect(currentOf(Number(duty)), frame.id).toBeCloseTo(Number(amps), 9);
        }
    });

    it("draws each square wave with the duty cycle its label names", () => {
        for (const id of ["b2", "c2", "c2-low", "digital"]) {
            const label = text.timing[id as keyof typeof text.timing];
            expect(dutyOf(id), label).toBe(Number(label.match(/(\d+) %/)![1]));
        }
        expect(dutyOf("a")).toBe(100);
    });

    it("draws each voltage at (V + 12) / 24", () => {
        expect(track("a").signal![0]![1]).toBe(1);
        expect(track("b1").signal![0]![1]).toBe(0.875);
        expect(track("b2").signal![0]![1]).toBe(0.875);
        expect(track("c2").signal![0]![1]).toBe(0.75);
        expect(Math.min(...track("c2").signal!.map(([, level]) => level))).toBe(0);
    });

    it("gets the state voltages from the car's resistors", () => {
        expect(cpVolts(2740)).toBeCloseTo(9, 0);
        expect(cpVolts(parallel(2740, 1300))).toBeCloseTo(6, 0);
        expect(cpVolts(parallel(2740, 270))).toBeCloseTo(3, 0);
    });

    it("draws no more current than it offers", () => {
        const offered = lesson.points!.rows.find((row) => row.id === "offer")!;
        const drawn = lesson.points!.rows.find((row) => row.id === "drawn")!;
        const amps = (value: string) => Number(value.match(/([\d.]+) A/)?.[1] ?? 0);
        expect(amps(drawn.values.find(([step]) => step === "charge")![1])).toBeLessThanOrEqual(amps(offered.values.find(([step]) => step === "offer")![2]));
        expect(amps(drawn.values.find(([step]) => step === "reduce")![1])).toBeLessThanOrEqual(amps(offered.values.find(([step]) => step === "reduce")![2]));
    });
});
