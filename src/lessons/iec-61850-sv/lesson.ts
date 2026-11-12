import type { Field, Lesson } from "../types";
import processBus from "./process-bus.scd?raw";

/** The values of one ASDU: four currents in mA and four voltages in units of 10 mV, each followed by its quality. */
type Channels = readonly [ia: string, ib: string, ic: string, inn: string, va: string, vb: string, vc: string, vn: string];

const GOOD = "00 00 00 00";

/** A 9-2 LE frame of F1 MU's stream: the parts that never change, then the counter, the sync flag and the samples. */
function sv(smpCnt: string, synch: "00" | "01", samples: readonly Field[]): Field[] {
    return [
        ["01 0C CD 04 00 01", "address", "dst"],
        ["02 00 00 00 00 B1", "address", "src"],
        ["81 00 80 14", "control", "vlan"],
        ["88 BA", "type", "ethertype"],
        ["40 00", "address", "appid"],
        ["00 6A", "size", "length"],
        ["00 00 00 00", "frame", "reserved"],
        ["60 60", "frame", "savpdu"],
        ["80 01 01", "size", "noasdu"],
        ["A2 5B", "frame", "seqasdu"],
        ["30 59", "frame", "asdu"],
        ["80 08 46 31 4D 55 53 56 30 31", "address", "svid"],
        [`82 02 ${smpCnt}`, "control", `smpcnt-${parseInt(smpCnt.replace(" ", ""), 16)}`],
        ["83 04 00 00 00 01", "control", "confrev"],
        [`85 01 ${synch}`, "time", `synch-${parseInt(synch, 16)}`],
        ...samples,
    ];
}

/** The eight samples, one field each, with their qualities between them. */
const channels = (values: Channels, keys: Channels): Field[] => [
    ["87 40", "size", "seqdata"],
    ...values.flatMap((value, i): Field[] => [
        [value, "value", keys[i]!],
        [GOOD, "quality", "q"],
    ]),
];

/** The same eight samples in the frames after the first: what each one is, the value is in the table. */
const LATER: Channels = ["x-ia", "x-ib", "x-ic", "x-in", "x-va", "x-vb", "x-vc", "x-vn"];

export const lesson: Lesson = {
    actors: ["q1", "mu", "relay", "clock"],
    scene: {
        devices: [
            { id: "clock", kind: "clock", at: [0.4, 0] },
            { id: "ctvt", kind: "transformer", at: [1.2, 3.6] },
            { id: "switch", kind: "switch", at: [5, 0] },
            { id: "mu", kind: "merging-unit", at: [5, 3.6], active: true },
            { id: "q1", kind: "breaker", at: [5, 7.2] },
            { id: "relay", kind: "relay", at: [8.6, 0], active: true },
        ],
        links: [
            { id: "ptp", from: "clock", to: "switch", label: "PTP" },
            { id: "analog", from: "ctvt", to: "mu" },
            { id: "trip", from: "q1", to: "mu", via: "y" },
            { id: "bus1", from: "mu", to: "switch", via: "y", label: "SV · 0x88BA", active: true },
            { id: "bus2", from: "relay", to: "switch", active: true },
        ],
    },
    steps: [{ id: "sync" }, { id: "sample" }, { id: "gap" }, { id: "unsync" }, { id: "fault" }, { id: "open" }],
    frames: [
        { id: "ptp-sync", step: "sync", from: "clock", to: ["mu", "relay"], kind: "PTP", name: "Sync", time: "0.0000" },
        {
            id: "sv-0",
            step: "sample",
            from: "mu",
            to: "relay",
            kind: "SV",
            name: "smpCnt 0 · smpSynch 1",
            time: "1.0000",
            fields: sv(
                "00 00",
                "01",
                channels(["00 08 1C 72", "FF F9 63 44", "FF FE 80 4A", "00 00 00 00", "00 2A FB 91", "FF EA 82 37", "FF EA 82 38", "00 00 00 00"], ["ia", "ib", "ic", "in", "va", "vb", "vc", "vn"]),
            ),
        },
        {
            id: "sv-gap",
            step: "gap",
            from: "mu",
            to: "relay",
            kind: "SV",
            name: "smpCnt 1238 · smpSynch 1",
            time: "1.3095",
            fields: sv("04 D6", "01", channels(["FF F8 73 58", "00 07 66 17", "00 00 26 91", "00 00 00 00", "FF D5 8B E8", "00 1B 0C C5", "00 0F 67 53", "00 00 00 00"], LATER)),
        },
        {
            id: "sv-unsync",
            step: "unsync",
            from: "mu",
            to: "relay",
            kind: "SV",
            name: "smpCnt 2650 · smpSynch 0",
            time: "614.6625",
            fields: sv("0A 5A", "00", channels(["00 06 50 14", "00 01 F1 14", "FF F7 BE D8", "00 00 00 00", "00 13 83 84", "00 17 68 F9", "FF D5 13 83", "00 00 00 00"], LATER)),
        },
        {
            id: "sv-fault",
            step: "fault",
            from: "mu",
            to: "relay",
            kind: "SV",
            name: "smpCnt 3127 · smpSynch 0",
            time: "731.7818",
            fields: sv("0C 37", "00", channels(["FF C6 11 04", "FF FE B9 62", "00 08 07 F4", "FF CC D2 5A", "FF FA 62 AA", "FF EB 7D 8D", "00 2A F7 CC", "00 10 D8 03"], ["ia-f", "ib-f", "ic-f", "in-f", "va-f", "vb-f", "vc-f", "vn-f"])),
        },
        { id: "goose-trip", step: "fault", from: "relay", to: "mu", kind: "GOOSE", name: "PTRC1.Tr · TRUE", time: "731.8030" },
        { id: "trip-wire", step: "fault", from: "mu", to: "q1", kind: "Wire", name: "Trip contact closes", time: "731.8045" },
        { id: "sv-open", step: "open", from: "mu", to: "relay", kind: "SV", name: "smpCnt 3447 · smpSynch 0", time: "731.8618" },
    ],
    facts: ["standard", "between", "transport", "frames", "speed"],
    points: {
        device: "mu",
        receiver: "relay",
        rows: [
            {
                id: "smpcnt",
                address: "smpCnt",
                values: [
                    ["sync", "–", "–"],
                    ["sample", "0", "0"],
                    ["gap", "1238", "~gap"],
                    ["unsync", "2650", "2650"],
                    ["fault", "3127", "3127"],
                    ["open", "3447", "3447"],
                ],
            },
            {
                id: "synch",
                address: "smpSynch",
                values: [
                    ["sync", "1", "–"],
                    ["sample", "1", "1"],
                    ["unsync", "0", "0"],
                ],
            },
            {
                id: "ia",
                address: "TCTR1.Amp",
                values: [
                    ["sync", "–", "–"],
                    ["sample", "531.57 A", "531.57 A"],
                    ["gap", "-494.76 A", "-494.76 A"],
                    ["unsync", "413.72 A", "413.72 A"],
                    ["fault", "-3796.73 A", "-3796.73 A"],
                    ["open", "≈ 0 A", "≈ 0 A"],
                ],
            },
        ],
    },
    singleLine: {
        feeders: [
            { id: "f1", load: "line" },
            { id: "f2", load: "supply" },
        ],
        ieds: [
            { id: "mu", feeder: "f1", bus: "process" },
            { id: "relay", bus: "station" },
        ],
        states: [
            { step: "sync" },
            { step: "sample", flow: { from: "mu", to: ["relay"], label: "SV · smpCnt 0 · smpSynch 1" } },
            { step: "gap", flow: { from: "mu", to: ["relay"], label: "SV · smpCnt 1236 → 1238" } },
            { step: "unsync", flow: { from: "mu", to: ["relay"], label: "SV · smpSynch 0" } },
            { step: "fault", fault: "f1", flow: { from: "mu", to: ["relay"], label: "SV · IA 2.8 kA" } },
            { step: "open", open: ["f1"], flow: { from: "mu", to: ["relay"], label: "SV · IA ≈ 0 A" } },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 20,
        ticks: [0, 2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20],
        tracks: [
            {
                id: "va",
                // Phase A voltage as the relay sees it: one level per sample, held until the next
                signal: Array.from({ length: 80 }, (_, k) => [k * 0.25, Math.round((0.5 + 0.45 * Math.cos((2 * Math.PI * k) / 80)) * 1000) / 1000] as const),
            },
            {
                id: "frames",
                events: Array.from({ length: 81 }, (_, k) => ({ t: k * 0.25, mark: "repeat" as const, ...(k === 0 ? { label: "smp0" } : k === 40 ? { label: "smp40" } : {}) })),
            },
        ],
    },
    playground: [{ kind: "scl", sample: "process-bus.scd", file: processBus }],
    related: ["iec-61850-goose", "ptp", "prp-hsr", "r-goose"],
};
