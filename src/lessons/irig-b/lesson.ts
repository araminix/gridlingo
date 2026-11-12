import type { Field, Lesson } from "../types";

const RELAYS = ["r1", "r2", "r3"] as const;

/**
 * One IRIG-B frame of day 316 of 2026, as the byte inspector shows it: each BCD group as hex digits (seconds 07 → "07"),
 * the control bits as small numbers, the straight binary seconds as a hex number. IRIG-B itself sends 100 pulses.
 */
function frame(time: { s: string; m: string; h: string }, keys: { s: string; m: string; h: string }, quality: "00" | "05", parity: "00" | "01", sbs: [string, string]): Field[] {
    return [
        [time.s, "time", keys.s],
        [time.m, "time", keys.m],
        [time.h, "time", keys.h],
        ["03 16", "time", "day-316"],
        ["26", "time", "year-26"],
        ["00", "control", "cf-flags"],
        ["00", "control", "cf-offset"],
        [quality, "quality", `tq-${parseInt(quality, 16)}`],
        [parity, "control", `parity-${parseInt(parity, 16)}`],
        [sbs[0], "value", sbs[1]],
    ];
}

/** The first eleven bit cells of the 10:41:07 frame: P0 (bit 99 of the last frame), Pr (bit 0), then bits 1 to 9. */
const FIRST_BITS = ["P", "P", 1, 1, 1, 0, 0, 0, 0, 0, "P"] as const;
/** A pulse lasts 2 ms for a 0, 5 ms for a 1 and 8 ms for a position marker, at the start of each 10 ms cell. */
const width = (bit: (typeof FIRST_BITS)[number]) => (bit === "P" ? 8 : bit === 1 ? 5 : 2);

/** Unmodulated (B00x): the level is high for the pulse, low for the rest of the cell. */
const dcLevel = FIRST_BITS.flatMap((bit, i): [number, number][] => [
    [i * 10, 1],
    [i * 10 + width(bit), 0],
]);
/** Modulated (B12x): a 1 kHz carrier, loud during the pulse and quiet after it (10:3), drawn as square steps. */
const carrier = FIRST_BITS.flatMap((bit, i) =>
    Array.from({ length: 10 }, (_, ms): [number, number][] => {
        const amplitude = ms < width(bit) ? 0.5 : 0.15;
        return [
            [i * 10 + ms, 0.5 + amplitude],
            [i * 10 + ms + 0.5, 0.5 - amplitude],
        ];
    }).flat(),
);

export const lesson: Lesson = {
    actors: ["antenna", "clock", "r1", "r2", "r3", "q1"],
    scene: {
        devices: [
            { id: "antenna", kind: "radio", at: [1, -1.5] },
            { id: "clock", kind: "clock", at: [1, 2], address: "B004 · UTC", active: true },
            { id: "r1", kind: "relay", at: [5, 2], active: true },
            { id: "r2", kind: "relay", at: [8.5, 2], active: true },
            { id: "r3", kind: "relay", at: [12, 2], active: true },
            { id: "q1", kind: "breaker", at: [5, 5] },
        ],
        links: [
            { id: "coax", from: "antenna", to: "clock", via: "y" },
            { id: "irig1", from: "clock", to: "r1", label: "IRIG-B · B004", active: true },
            { id: "irig2", from: "r1", to: "r2", active: true },
            { id: "irig3", from: "r2", to: "r3", active: true },
            { id: "trip", from: "r1", to: "q1", via: "y" },
        ],
    },
    steps: [{ id: "lock" }, { id: "frame" }, { id: "set" }, { id: "event" }, { id: "holdover" }],
    frames: [
        { id: "gps", step: "lock", from: "antenna", to: "clock", kind: "GPS", name: "GPS L1 C/A", time: "0" },
        {
            id: "f07",
            step: "frame",
            from: "clock",
            to: RELAYS,
            kind: "IRIG-B",
            name: "B004 · 10:41:07 · day 316",
            time: "60",
            size: 0,
            fields: frame({ s: "07", m: "41", h: "10" }, { s: "sec-07", m: "min-41", h: "hour-10" }, "00", "00", ["96 43", "sbs-38467"]),
        },
        {
            id: "f08",
            step: "set",
            from: "clock",
            to: RELAYS,
            kind: "IRIG-B",
            name: "B004 · 10:41:08 · day 316",
            time: "61",
            size: 0,
            fields: frame({ s: "08", m: "41", h: "10" }, { s: "sec-08", m: "min-41", h: "hour-10" }, "00", "00", ["96 44", "sbs-38468"]),
        },
        { id: "trip", step: "event", from: "r1", to: "q1", kind: "Wire", name: "Trip · 10:52:31.283", time: "744.283" },
        { id: "lost", step: "holdover", from: "antenna", to: "clock", kind: "GPS", name: "No signal", time: "3595" },
        {
            id: "f-hold",
            step: "holdover",
            from: "clock",
            to: RELAYS,
            kind: "IRIG-B",
            name: "B004 · 14:12:31 · TQ 5",
            time: "12744",
            size: 0,
            fields: frame({ s: "31", m: "12", h: "14" }, { s: "sec-31", m: "min-12", h: "hour-14" }, "05", "01", ["C7 CF", "sbs-51151"]),
        },
    ],
    facts: ["standard", "between", "transport", "frames", "speed"],
    points: {
        device: "clock",
        receiver: "r1",
        rows: [
            { id: "time", address: "BCD · SBS", values: [["lock", "10:40:07", "–"], ["frame", "10:41:07", "–"], ["set", "10:41:08", "10:41:08"], ["event", "10:52:31", "10:52:31"], ["holdover", "14:12:31", "14:12:31"]] },
            { id: "quality", address: "CF 71–74", values: [["lock", "0", "–"], ["set", "0", "0"], ["holdover", "5", "5"]] },
            { id: "record", address: "SOE", values: [["lock", "–", "–"], ["event", "–", "10:52:31.283"]] },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 110,
        ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110],
        tracks: [
            { id: "bits", events: FIRST_BITS.map((bit, i) => (i === 1 ? { t: 10, mark: "event" as const, label: "on-time" } : { t: i * 10, mark: "beat" as const, label: i === 0 ? "p0" : i === 10 ? "p1" : bit === 1 ? "one" : "zero" })) },
            { id: "b00x", signal: dcLevel },
            { id: "b12x", signal: carrier },
        ],
    },
    anatomy: [
        {
            id: "code",
            parts: [
                ["B", "frame", "a-format"],
                ["1", "type", "a-modulation"],
                ["2", "control", "a-carrier"],
                ["4", "value", "a-content"],
            ],
            also: "B124 · B004",
        },
    ],
    related: ["ptp", "iec-103", "c37-118"],
};
