/** What a car reads from the control pilot's duty cycle, and the duty cycle a charger sends for a current (IEC 61851-1). */

export type PilotReading = { kind: "current"; amps: number } | { kind: "digital" } | { kind: "none" };

/** The rule, row by row, in duty cycle %: nothing, a talk in ISO 15118 instead, a fixed current, or a formula. */
export const RULE = [
    { range: "< 3", reading: "none" },
    { range: "3 – 7", reading: "digital" },
    { range: "7 – 8", reading: "none" },
    { range: "8 – 10", reading: "6 A" },
    { range: "10 – 85", reading: "% × 0.6 A" },
    { range: "85 – 96", reading: "(% − 64) × 2.5 A" },
    { range: "96 – 97", reading: "80 A" },
    { range: "> 97", reading: "none" },
] as const;

/** Which row of the rule a duty cycle falls in; the ranges' ends belong where the standard puts them. */
export function rowOf(duty: number): number {
    if (duty < 3) return 0;
    if (duty <= 7) return 1;
    if (duty < 8) return 2;
    if (duty < 10) return 3;
    if (duty <= 85) return 4;
    if (duty <= 96) return 5;
    if (duty <= 97) return 6;
    return 7;
}

export function readingOf(duty: number): PilotReading {
    if (!Number.isFinite(duty) || duty < 0 || duty > 100) return { kind: "none" };
    const row = rowOf(duty);
    const { reading } = RULE[row]!;
    if (reading === "none" || reading === "digital") return { kind: reading };
    const amps = row === 3 ? 6 : row === 6 ? 80 : row === 4 ? duty * 0.6 : (duty - 64) * 2.5;
    return { kind: "current", amps: Math.round(amps * 10) / 10 };
}

/** The duty cycle a charger sends to offer a current, in %: null outside 6 to 80 A. */
export function dutyFor(amps: number): number | null {
    if (!Number.isFinite(amps) || amps < 6 || amps > 80) return null;
    return Math.round((amps <= 51 ? amps / 0.6 : amps / 2.5 + 64) * 10) / 10;
}
