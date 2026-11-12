import type { Field, Lesson } from "../types";
import bess from "./bess.cid?raw";

/** The layers every MMS message rides in once the association is up: TPKT, COTP, session and presentation. */
const layers = (tpkt: string, tpktKey: string, presentation: string): Field[] => [
    [tpkt, "frame", tpktKey],
    ["02 F0 80", "frame", "cotp-dt"],
    ["01 00 01 00", "frame", "session"],
    [presentation, "frame", "presentation"],
];

/** "BESS1DER", the logical device of the battery inverter, as an MMS visible string. */
const DOMAIN = "1A 08 42 45 53 53 31 44 45 52";

export const lesson: Lesson = {
    actors: ["ppc", "bess"],
    scene: {
        devices: [
            { id: "meter", kind: "meter", at: [0, 0.5] },
            { id: "ppc", kind: "controller", at: [0.5, 4], address: "10.0.0.5", active: true },
            { id: "bess", kind: "inverter", at: [5, 2], address: "10.0.0.41", active: true },
            { id: "battery", kind: "battery", at: [8.5, 0.5] },
        ],
        links: [
            { id: "mms", from: "ppc", to: "bess", label: "MMS · TCP 102", active: true },
            { id: "poc", from: "ppc", to: "meter", via: "y" },
            { id: "dc", from: "bess", to: "battery", via: "y" },
        ],
    },
    steps: [{ id: "associate" }, { id: "read" }, { id: "subscribe" }, { id: "limit" }, { id: "report" }],
    frames: [
        { id: "tcp", step: "associate", from: "ppc", to: "bess", kind: "TCP", name: "TCP · COTP connect", time: "0.000" },
        { id: "initiate-req", step: "associate", from: "ppc", to: "bess", kind: "MMS", name: "Initiate-Request", time: "0.011" },
        { id: "initiate-resp", step: "associate", from: "bess", to: "ppc", kind: "MMS", name: "Initiate-Response", time: "0.027" },
        {
            id: "read-req",
            step: "read",
            from: "ppc",
            to: "bess",
            kind: "MMS",
            name: "Read · UseSocPct, TotW",
            time: "0.040",
            fields: [
                ...layers("03 00 00 6E", "tpkt-110", "61 61 30 5F 02 01 03 A0 5A"),
                ["A0 58", "type", "confirmed-req"],
                ["02 01 07", "control", "invoke-7"],
                ["A4 53", "type", "read"],
                ["A1 51 A0 4F", "size", "spec"],
                ["30 28 A0 26", "size", "var"],
                ["A1 24", "address", "domain-specific"],
                [DOMAIN, "address", "domain"],
                ["1A 18 44 53 54 4F 31 24 4D 58 24 55 73 65 53 6F 63 50 63 74 24 6D 61 67 24 66", "address", "item-soc"],
                ["30 23 A0 21", "size", "var"],
                ["A1 1F", "address", "domain-specific"],
                [DOMAIN, "address", "domain"],
                ["1A 13 4D 4D 58 55 31 24 4D 58 24 54 6F 74 57 24 6D 61 67 24 66", "address", "item-totw"],
            ],
        },
        {
            id: "read-resp",
            step: "read",
            from: "bess",
            to: "ppc",
            kind: "MMS",
            name: "Read · response",
            time: "0.046",
            fields: [
                ...layers("03 00 00 2B", "tpkt-43", "61 1E 30 1C 02 01 03 A0 17"),
                ["A1 15", "type", "confirmed-resp"],
                ["02 01 07", "control", "invoke-7-resp"],
                ["A4 10", "type", "read"],
                ["A1 0E", "size", "results"],
                ["87 05 08", "type", "float-tag"],
                ["42 89 00 00", "value", "soc"],
                ["87 05 08", "type", "float-tag"],
                ["45 3B 80 00", "value", "totw"],
            ],
        },
        { id: "enable", step: "subscribe", from: "ppc", to: "bess", kind: "MMS", name: "Write · urcbDER01$RptEna", time: "0.060" },
        {
            id: "oper-req",
            step: "limit",
            from: "ppc",
            to: "bess",
            kind: "MMS",
            name: "Write · DWMX1$CO$WMaxSpt$Oper",
            time: "12.250",
            fields: [
                ...layers("03 00 00 6F", "tpkt-111", "61 62 30 60 02 01 03 A0 5B"),
                ["A0 59", "type", "confirmed-req"],
                ["02 01 08", "control", "invoke-8"],
                ["A5 54", "type", "write"],
                ["A0 27 30 25 A0 23", "size", "write-spec"],
                ["A1 21", "address", "domain-specific"],
                [DOMAIN, "address", "domain"],
                ["1A 15 44 57 4D 58 31 24 43 4F 24 57 4D 61 78 53 70 74 24 4F 70 65 72", "address", "item-oper"],
                ["A0 29", "size", "data-list"],
                ["A2 27", "type", "oper-struct"],
                ["A2 07 87 05 08 44 FA 00 00", "value", "ctlval"],
                ["A2 08 85 01 05 89 03 50 50 43", "address", "origin"],
                ["86 01 01", "control", "ctlnum"],
                ["91 08 6A F5 97 C8 40 00 00 0A", "time", "oper-t"],
                ["83 01 00", "quality", "test"],
                ["84 02 06 00", "control", "check"],
            ],
        },
        {
            id: "oper-resp",
            step: "limit",
            from: "bess",
            to: "ppc",
            kind: "MMS",
            name: "Write · response",
            time: "12.262",
            fields: [
                ...layers("03 00 00 1D", "tpkt-29", "61 10 30 0E 02 01 03 A0 09"),
                ["A1 07", "type", "confirmed-resp"],
                ["02 01 08", "control", "invoke-8-resp"],
                ["A5 02", "type", "write-resp"],
                ["81 00", "value", "success"],
            ],
        },
        { id: "report", step: "report", from: "bess", to: "ppc", kind: "MMS", name: "InformationReport · urcbDER01", time: "27.480" },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    points: {
        device: "bess",
        receiver: "ppc",
        rows: [
            { id: "soc", address: "DSTO1.UseSocPct", values: [["associate", "68.5 %", "–"], ["read", "68.5 %", "68.5 %"]] },
            {
                id: "totw",
                address: "MMXU1.TotW",
                values: [
                    ["associate", "3000.0 kW", "–"],
                    ["read", "3000.0 kW", "3000.0 kW"],
                    ["limit", "2640.0 kW", "3000.0 kW"],
                    ["report", "2000.0 kW", "2000.0 kW"],
                ],
            },
            { id: "wmax", address: "DWMX1.WMaxSpt", values: [["associate", "5000.0 kW", "–"], ["limit", "2000.0 kW", "2000.0 kW"]] },
        ],
    },
    anatomy: [
        {
            id: "control",
            parts: [
                ["BESS1DER", "address", "a-ld"],
                ["DWMX1", "type", "a-ln"],
                ["CO", "cause", "a-fc"],
                ["WMaxSpt", "value", "a-do"],
                ["Oper", "time", "a-da"],
            ],
            also: "BESS1DER/DWMX1.WMaxSpt.Oper [CO]  ·  MMS: BESS1DER/DWMX1$CO$WMaxSpt$Oper",
        },
    ],
    playground: [
        { kind: "scl", sample: "bess.cid", file: bess },
        { kind: "encoder", type: "float32", order: "ABCD", value: 2000 },
    ],
    related: ["iec-61850-mms", "sunspec", "iec-61400-25", "ieee-2030-5"],
};
