import type { Lesson } from "../types";
import gatewayConfig from "./gateway-chrony.conf?raw";

// The RTU's clock is 1.5 s slow. Its request leaves at 10:41:07.250 000 UTC (10:41:05.750 000 on its own clock), takes
// 0.4 ms to the GPS clock, waits 0.1 ms there and takes 0.4 ms back: t4 is 10:41:05.750 900 on the RTU's clock.
const T1 = "EE A0 16 41 C0 00 00 00";
const T2 = "EE A0 16 43 40 1A 36 E3";
const T3 = "EE A0 16 43 40 20 C4 9C";

export const lesson: Lesson = {
    actors: ["clock", "switch", "rtu", "scada"],
    scene: {
        devices: [
            { id: "antenna", kind: "radio", at: [0, -0.5] },
            { id: "clock", kind: "clock", at: [0, 3], address: "10.20.0.10", active: true },
            { id: "switch", kind: "switch", at: [4.5, 3] },
            { id: "rtu", kind: "rtu", at: [9, 3], address: "10.20.0.31", active: true },
            { id: "scada", kind: "scada", at: [9, 7.5] },
        ],
        links: [
            { id: "gps", from: "antenna", to: "clock", via: "y" },
            { id: "ntp", from: "clock", to: "switch", label: "NTP · UDP 123", active: true },
            { id: "lan", from: "switch", to: "rtu", active: true },
            { id: "wan", from: "rtu", to: "scada", via: "y" },
        ],
    },
    steps: [{ id: "ask" }, { id: "answer" }, { id: "correct" }, { id: "lost" }],
    frames: [
        {
            id: "request",
            step: "ask",
            from: "rtu",
            to: "clock",
            kind: "SNTP",
            name: "Client request · mode 3",
            time: "0.000000",
            fields: [
                ["23", "control", "first-request"],
                ["00", "quality", "stratum-0"],
                ["06", "time", "poll"],
                ["00", "quality", "precision-0"],
                ["00 00 00 00 00 00 00 00 00 00 00 00", "frame", "unused-12"],
                ["00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00", "frame", "unused-24"],
                [T1, "time", "t1"],
            ],
        },
        {
            id: "reply",
            step: "answer",
            from: "clock",
            to: "rtu",
            kind: "NTP",
            name: "Server reply · stratum 1 · GPS",
            time: "0.000500",
            fields: [
                ["24", "control", "first-reply"],
                ["01", "quality", "stratum-1"],
                ["06", "time", "poll-copy"],
                ["EC", "quality", "precision"],
                ["00 00 00 00", "quality", "delay-root"],
                ["00 00 00 0A", "quality", "dispersion"],
                ["47 50 53 00", "address", "refid-gps"],
                ["EE A0 16 43 00 00 00 00", "time", "reference"],
                [T1, "time", "origin"],
                [T2, "time", "t2"],
                [T3, "time", "t3"],
            ],
        },
        { id: "next", step: "correct", from: "rtu", to: "clock", kind: "SNTP", name: "Client request · 64 s later", time: "64.000000" },
        { id: "next-reply", step: "correct", from: "clock", to: "rtu", kind: "NTP", name: "Server reply · offset +0.08 ms", time: "64.000500" },
        { id: "unsync", step: "lost", from: "clock", to: "rtu", kind: "NTP", name: "Server reply · LI 3", time: "7264.000500" },
        { id: "alarm", step: "lost", from: "rtu", to: "scada", kind: "IEC 104", name: "M_SP_TB_1 · Time sync lost", time: "7264.001000" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "clock",
        receiver: "rtu",
        rows: [
            { id: "time", address: "UTC", values: [["ask", "10:41:07.250", "10:41:05.750"], ["correct", "10:42:11.250", "10:42:11.250"]] },
            { id: "offset", address: "θ", values: [["ask", "~reference", "–"], ["answer", "~reference", "+1.500 000 s"], ["correct", "~reference", "+0.08 ms"]] },
            { id: "delay", address: "δ", values: [["ask", "–", "–"], ["answer", "–", "0.800 ms"]] },
            { id: "stratum", address: "Stratum", values: [["ask", "1", "–"], ["correct", "1", "2"], ["lost", "–", "–"]] },
            { id: "synced", address: "LI", values: [["ask", "~yes", "~no"], ["correct", "~yes", "~yes"], ["lost", "~no", "~no"]] },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 1.2,
        ticks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2],
        tracks: [
            {
                id: "rtu",
                events: [
                    { t: 0, mark: "event", label: "t1" },
                    { t: 0.9, mark: "event", label: "t4" },
                ],
            },
            {
                id: "clock",
                events: [
                    { t: 0.4, mark: "repeat", label: "t2" },
                    { t: 0.5, mark: "repeat", label: "t3" },
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "timestamp",
            parts: [
                ["EE A0 16 43", "time", "a-seconds"],
                ["40 20 C4 9C", "time", "a-fraction"],
            ],
            also: "0xEEA01643 = 4003468867 s since 1900-01-01  →  2026-11-12 10:41:07 UTC  ·  0x4020C49C / 2^32 = 0.250 500 s",
        },
    ],
    playground: [{ kind: "file", sample: "gateway-chrony.conf", file: gatewayConfig, notes: { 2: "servers", 3: "second", 4: "makestep", 5: "distance", 6: "rtc", 7: "drift", 8: "leap", 9: "serve" } }],
    related: ["ptp", "irig-b", "iec-104", "iec-62351"],
};
