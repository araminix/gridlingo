import type { Field, Lesson } from "../types";

/** One bit at 2400 baud, in ms. */
const BIT = 1000 / 2400;

/**
 * Characters on the bus at 2400 baud, 8E1 (a start bit, 8 data bits lowest first, even parity, a stop bit), as signal levels
 * from each time on: `mark` for a 1, `space` for a 0.
 */
function line(bytes: readonly number[], start: number, mark: number, space: number): [number, number][] {
    const bits = bytes.flatMap((byte) => {
        const data = Array.from({ length: 8 }, (_, i) => (byte >> i) & 1);
        return [0, ...data, data.reduce((parity, bit) => parity ^ bit, 0), 1];
    });
    const levels: [number, number][] = start > 0 ? [[0, mark]] : [];
    bits.forEach((bit, i) => {
        const level = bit ? mark : space;
        if (levels.at(-1)?.[1] !== level) levels.push([Math.round((start + i * BIT) * 1000) / 1000, level]);
    });
    return levels;
}

/** The fixed header of the heat meter's answers: ID 12345678, maker EXA, version 1, heat, the access number, status, no signature. */
const header = (access: "2A" | "2B"): Field[] => [
    ["78 56 34 12", "address", "id"],
    ["01 17", "address", "maker"],
    ["01", "type", "version"],
    ["04", "type", "medium"],
    [access, "control", `access-${parseInt(access, 16)}`],
    ["00", "quality", "status"],
    ["00 00", "security", "signature"],
];

export const lesson: Lesson = {
    actors: ["heat", "collector", "water"],
    scene: {
        devices: [
            { id: "heat", kind: "meter", at: [3, 5], address: "primary 5", active: true },
            { id: "collector", kind: "gateway", at: [3, 0], address: "M-Bus master", active: true },
            { id: "water", kind: "meter", at: [8, 0], address: "ID 87654321", active: true },
        ],
        links: [
            { id: "bus", from: "heat", to: "collector", label: "M-Bus · 2400 baud", active: true },
            { id: "radio", from: "water", to: "collector", label: "wM-Bus T1 · 868.95 MHz", radio: true },
        ],
    },
    steps: [{ id: "reset" }, { id: "ask" }, { id: "answer" }, { id: "next" }, { id: "radio" }],
    frames: [
        {
            id: "snd-nke",
            step: "reset",
            from: "collector",
            to: "heat",
            kind: "Short",
            name: "SND_NKE",
            time: "0.000",
            fields: [["10", "frame", "short"], ["40", "control", "c-nke"], ["05", "address", "a-5"], ["45", "frame", "cs-nke"], ["16", "frame", "stop"]],
        },
        { id: "e5", step: "reset", from: "heat", to: "collector", kind: "ACK", name: "E5", time: "0.030", fields: [["E5", "control", "e5"]] },
        {
            id: "req-1",
            step: "ask",
            from: "collector",
            to: "heat",
            kind: "Short",
            name: "REQ_UD2 · FCB 1",
            time: "0.150",
            fields: [["10", "frame", "short"], ["7B", "control", "c-req-1"], ["05", "address", "a-5"], ["80", "frame", "cs-req-1"], ["16", "frame", "stop"]],
        },
        {
            id: "rsp-1",
            step: "answer",
            from: "heat",
            to: "collector",
            kind: "Long",
            name: "RSP_UD · telegram 1",
            time: "0.185",
            fields: [
                ["68 2A 2A 68", "frame", "long-42"],
                ["08", "control", "c-rsp"],
                ["05", "address", "a-5-rsp"],
                ["72", "type", "ci"],
                ...header("2A"),
                ["0C 06 45 23 01 00", "value", "energy"],
                ["0C 14 78 56 04 00", "value", "volume"],
                ["0A 5A 02 07", "value", "flow"],
                ["0A 5E 53 04", "value", "return"],
                ["04 6D 0F 08 4C 3B", "time", "now"],
                ["1F", "control", "more"],
                ["A1", "frame", "cs-rsp-1"],
                ["16", "frame", "stop"],
            ],
        },
        {
            id: "req-2",
            step: "next",
            from: "collector",
            to: "heat",
            kind: "Short",
            name: "REQ_UD2 · FCB 0",
            time: "0.450",
            fields: [["10", "frame", "short"], ["5B", "control", "c-req-2"], ["05", "address", "a-5"], ["60", "frame", "cs-req-2"], ["16", "frame", "stop"]],
        },
        {
            id: "rsp-2",
            step: "next",
            from: "heat",
            to: "collector",
            kind: "Long",
            name: "RSP_UD · telegram 2",
            time: "0.485",
            fields: [
                ["68 1F 1F 68", "frame", "long-31"],
                ["08", "control", "c-rsp"],
                ["05", "address", "a-5-rsp"],
                ["72", "type", "ci"],
                ...header("2B"),
                ["42 6C 3F 3C", "time", "due-date"],
                ["4C 06 76 98 00 00", "value", "due-energy"],
                ["4C 14 23 81 03 00", "value", "due-volume"],
                ["6B", "frame", "cs-rsp-2"],
                ["16", "frame", "stop"],
            ],
        },
        { id: "wmbus", step: "radio", from: "water", to: "collector", kind: "SND_NR", name: "T1 · C 0x44 · CI 0x7A · mode 5", time: "2.700" },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "heat",
        receiver: "collector",
        rows: [
            { id: "energy", address: "0C 06", values: [["reset", "12345 kWh", "–"], ["answer", "12345 kWh", "12345 kWh"]] },
            { id: "volume", address: "0C 14", values: [["reset", "456.78 m³", "–"], ["answer", "456.78 m³", "456.78 m³"]] },
            { id: "flow", address: "0A 5A", values: [["reset", "70.2 °C", "–"], ["answer", "70.2 °C", "70.2 °C"]] },
            { id: "due", address: "4C 06", values: [["reset", "9876 kWh", "–"], ["next", "9876 kWh", "9876 kWh"]] },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 36,
        ticks: [0, 5, 10, 15, 20, 25, 30, 35],
        tracks: [
            // The master sends SND_NKE by lowering the bus voltage: 36 V for a 1, 24 V for a 0
            { id: "master", signal: line([0x10, 0x40, 0x05, 0x45, 0x16], 0, 1, 24 / 36) },
            // The meter answers E5 by drawing current: 1.5 mA for a 1, 15 mA more for a 0
            { id: "meter", signal: line([0xe5], 30, 1.5 / 16.5, 1) },
        ],
    },
    anatomy: [
        {
            id: "maker",
            parts: [
                ["E", "address", "m-1"],
                ["X", "type", "m-2"],
                ["A", "value", "m-3"],
            ],
            also: "5 × 1024 + 24 × 32 + 1 = 5889 = 0x1701  ·  sent low byte first: 01 17",
        },
        {
            id: "dif",
            parts: [
                ["0", "frame", "d-extension"],
                ["1", "address", "d-storage"],
                ["00", "cause", "d-function"],
                ["1100", "type", "d-data"],
            ],
            also: "DIF 0x4C = 0100 1100  ·  then VIF 0x06: energy in kWh",
        },
    ],
    related: ["dlms-cosem", "iec-62056-21", "lorawan"],
};
