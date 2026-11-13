import type { Field, Lesson } from "../types";
import table from "./bilateral-table.json?raw";

/** The layers every MMS message rides in once the association is up: TPKT, COTP, session and presentation. */
const layers = (tpkt: string, tpktKey: string, presentation: string): Field[] => [
    [tpkt, "frame", tpktKey],
    ["02 F0 80", "frame", "cotp-dt"],
    ["01 00 01 00", "frame", "session"],
    [presentation, "frame", "presentation"],
];

export const lesson: Lesson = {
    actors: ["dso", "tso"],
    scene: {
        devices: [
            { id: "dso", kind: "scada", at: [0, 4], address: "10.20.0.10", active: true },
            { id: "dsovpn", kind: "gateway", at: [0, 0.5] },
            { id: "tsovpn", kind: "gateway", at: [6, 0.5] },
            { id: "tso", kind: "scada", at: [6, -3], address: "10.10.0.10", active: true },
            { id: "sub", kind: "transformer", at: [9.5, -3] },
        ],
        links: [
            { id: "lan-dso", from: "dso", to: "dsovpn", via: "y" },
            { id: "vpn", from: "dsovpn", to: "tsovpn", label: "ICCP · TCP 102", active: true },
            { id: "lan-tso", from: "tsovpn", to: "tso", via: "y" },
            { id: "rtu", from: "sub", to: "tso", label: "IEC 104" },
        ],
    },
    steps: [{ id: "connect" }, { id: "check" }, { id: "subscribe" }, { id: "interval" }, { id: "change" }, { id: "denied" }],
    frames: [
        { id: "connect", step: "connect", from: "dso", to: "tso", kind: "TCP", name: "TCP 102 · COTP CR · CC", time: "0.000" },
        { id: "initiate-req", step: "connect", from: "dso", to: "tso", kind: "MMS", name: "Initiate-Request · AP title 1.3.9999.20", time: "0.018" },
        { id: "initiate-resp", step: "connect", from: "tso", to: "dso", kind: "MMS", name: "Initiate-Response", time: "0.041" },
        {
            id: "blt-req",
            step: "check",
            from: "dso",
            to: "tso",
            kind: "MMS",
            name: "Read · DSO_EAST/Bilateral_Table_ID",
            time: "0.050",
            fields: [
                ...layers("03 00 00 43", "tpkt-67", "61 36 30 34 02 01 03 A0 2F"),
                ["A0 2D", "type", "confirmed-req"],
                ["02 01 01", "control", "invoke"],
                ["A4 28", "type", "read"],
                ["A1 26 A0 24 30 22 A0 20", "size", "spec"],
                ["A1 1E", "address", "domain-specific"],
                ["1A 08 44 53 4F 5F 45 41 53 54", "address", "domain"],
                ["1A 12 42 69 6C 61 74 65 72 61 6C 5F 54 61 62 6C 65 5F 49 44", "address", "item"],
            ],
        },
        {
            id: "blt-resp",
            step: "check",
            from: "tso",
            to: "dso",
            kind: "MMS",
            name: "Read · response",
            time: "0.061",
            fields: [
                ...layers("03 00 00 2E", "tpkt-46", "61 21 30 1F 02 01 03 A0 1A"),
                ["A1 18", "type", "confirmed-resp"],
                ["02 01 01", "control", "invoke-resp"],
                ["A4 13", "type", "read"],
                ["A1 11", "size", "results"],
                ["8A 0F 44 53 4F 45 41 53 54 2D 32 30 32 36 2D 30 33", "value", "blt-value"],
            ],
        },
        { id: "define-ds", step: "subscribe", from: "dso", to: "tso", kind: "MMS", name: "DefineNamedVariableList · DS_TIELINES", time: "0.072" },
        { id: "define-ok", step: "subscribe", from: "tso", to: "dso", kind: "MMS", name: "DefineNamedVariableList · response", time: "0.083" },
        { id: "next-ts", step: "subscribe", from: "dso", to: "tso", kind: "MMS", name: "Read · DSO_EAST/Next_DSTransfer_Set", time: "0.091" },
        { id: "next-ts-resp", step: "subscribe", from: "tso", to: "dso", kind: "MMS", name: "Read · response · DSTS_07", time: "0.099" },
        { id: "ts-start", step: "subscribe", from: "dso", to: "tso", kind: "MMS", name: "Write · DSO_EAST/DSTS_07", time: "0.108" },
        { id: "report-interval", step: "interval", from: "tso", to: "dso", kind: "MMS", name: "InformationReport · DS_TIELINES", time: "4.108" },
        { id: "report-change", step: "change", from: "tso", to: "dso", kind: "MMS", name: "InformationReport · DS_TIELINES", time: "6.731" },
        { id: "denied-req", step: "denied", from: "dso", to: "tso", kind: "MMS", name: "Read · GEN_K1_MW", time: "9.420" },
        { id: "denied-resp", step: "denied", from: "tso", to: "dso", kind: "MMS", name: "Read · response · access error", time: "9.428" },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    points: {
        device: "tso",
        receiver: "dso",
        rows: [
            { id: "blt", address: "Bilateral_Table_ID", values: [["connect", "DSOEAST-2026-03", "–"], ["check", "DSOEAST-2026-03", "DSOEAST-2026-03"]] },
            { id: "tie1", address: "TIE1_MW", values: [["connect", "212.4 MW", "–"], ["interval", "212.4 MW", "212.4 MW"], ["change", "248.9 MW", "248.9 MW"]] },
            { id: "tie2", address: "TIE2_MW", values: [["connect", "36.2 MW", "–"], ["interval", "36.2 MW", "36.2 MW"], ["change", "0.0 MW", "0.0 MW"]] },
            { id: "cb2", address: "TIE2_CB", values: [["connect", "~closed", "–"], ["interval", "~closed", "~closed"], ["change", "~open", "~open"]] },
        ],
    },
    timing: {
        unit: "s",
        scale: "linear",
        end: 16,
        ticks: [0, 4, 8, 12, 16],
        tracks: [
            { id: "dso", events: [{ t: 0, mark: "repeat", label: "start" }] },
            {
                id: "interval",
                events: [
                    { t: 4, mark: "beat", label: "every-4s" },
                    { t: 8, mark: "beat" },
                    { t: 12, mark: "beat" },
                    { t: 16, mark: "beat" },
                ],
            },
            { id: "change", events: [{ t: 6.6, mark: "event", label: "tie2-open" }] },
        ],
    },
    anatomy: [
        {
            id: "name",
            parts: [
                ["DSO_EAST", "address", "n-domain"],
                ["/", "frame", "n-sep"],
                ["Next_DSTransfer_Set", "type", "n-object"],
            ],
            also: "MMS: domain DSO_EAST, variable Next_DSTransfer_Set  ·  read with a confirmed Read; the answer names DSTS_07",
        },
    ],
    playground: [{ kind: "file", sample: "bilateral-table.json", file: table, notes: { 2: "table", 3: "table-id", 6: "client-ap", 10: "blocks", 11: "read", 12: "data-value", 14: "state", 16: "write", 17: "devices", 18: "transfer-sets" } }],
    related: ["iec-61850-mms", "iec-104", "iec-62351"],
};
