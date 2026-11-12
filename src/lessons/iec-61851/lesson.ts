import type { Lesson } from "../types";

/** The control pilot's voltage as a level of the timing chart: −12 V is 0, +12 V is 1. */
const level = (volts: number) => (volts + 12) / 24;

/** Three periods of the 1 kHz square wave: the high level for the duty cycle's share of each millisecond, −12 V for the rest. */
const pwm = (high: number, duty: number) => [0, 1, 2].flatMap((ms) => [[ms, level(high)] as const, [ms + duty / 100, level(-12)] as const]);

export const lesson: Lesson = {
    actors: ["car", "charger", "ems"],
    scene: {
        devices: [
            { id: "car", kind: "car", at: [-1, 4], active: true },
            { id: "charger", kind: "charger", at: [3.5, 1.5], active: true },
            { id: "ems", kind: "building", at: [7.5, -0.5] },
        ],
        links: [
            { id: "cp", from: "charger", to: "car", label: "CP · PWM 1 kHz", via: "y", active: true },
            { id: "supply", from: "charger", to: "ems" },
        ],
    },
    steps: [{ id: "plug" }, { id: "offer" }, { id: "charge" }, { id: "reduce" }, { id: "stop" }, { id: "unplug" }],
    frames: [
        { id: "b1", step: "plug", from: "car", to: "charger", kind: "CP", name: "State B1 · +9 V", time: "0.000" },
        { id: "pp", step: "plug", from: "car", to: "charger", kind: "PP", name: "PP · 220 Ω → 32 A", time: "0.020" },
        { id: "pwm", step: "offer", from: "charger", to: "car", kind: "CP", name: "PWM 1 kHz · 40 % → 24 A", time: "0.500" },
        { id: "c", step: "charge", from: "car", to: "charger", kind: "CP", name: "State C2 · +6 V", time: "2.100" },
        { id: "contactor", step: "charge", from: "charger", to: "car", kind: "AC", name: "Contactor closed · L1 L2 L3 N", time: "2.300" },
        { id: "limit", step: "reduce", from: "ems", to: "charger", kind: "EMS", name: "Current limit · 6 A", time: "1800.000" },
        { id: "pwm-10", step: "reduce", from: "charger", to: "car", kind: "CP", name: "PWM 1 kHz · 10 % → 6 A", time: "1800.200" },
        { id: "b2", step: "stop", from: "car", to: "charger", kind: "CP", name: "State B2 · +9 V", time: "5400.000" },
        { id: "open", step: "stop", from: "charger", to: "car", kind: "AC", name: "Contactor open", time: "5400.050" },
        { id: "a", step: "unplug", from: "car", to: "charger", kind: "CP", name: "State A · +12 V", time: "5460.000" },
    ],
    facts: ["standard", "between", "transport", "security", "frames", "speed"],
    points: {
        device: "charger",
        receiver: "car",
        rows: [
            {
                id: "state",
                address: "CP",
                values: [
                    ["plug", "B1", "B1"],
                    ["offer", "B2", "B2"],
                    ["charge", "C2", "C2"],
                    ["stop", "B2", "B2"],
                    ["unplug", "A1", "–"],
                ],
            },
            { id: "cable", address: "PP", values: [["plug", "220 Ω → 32 A", "32 A"], ["unplug", "–", "–"]] },
            {
                id: "offer",
                address: "PWM",
                values: [
                    ["plug", "–", "–"],
                    ["offer", "40 % → 24 A", "24 A"],
                    ["reduce", "10 % → 6 A", "6 A"],
                    ["unplug", "–", "–"],
                ],
            },
            {
                id: "drawn",
                address: "L1 L2 L3",
                values: [
                    ["plug", "0 A", "0 A"],
                    ["charge", "23.8 A", "23.8 A"],
                    ["reduce", "5.9 A", "5.9 A"],
                    ["stop", "0 A", "0 A"],
                ],
            },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 3,
        ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3],
        tracks: [
            { id: "a", signal: [[0, level(12)]] },
            { id: "b1", signal: [[0, level(9)]] },
            { id: "b2", signal: pwm(9, 40) },
            { id: "c2", signal: pwm(6, 40) },
            { id: "c2-low", signal: pwm(6, 10) },
            { id: "digital", signal: pwm(9, 5) },
        ],
    },
    related: ["iso-15118", "ocpp"],
};
