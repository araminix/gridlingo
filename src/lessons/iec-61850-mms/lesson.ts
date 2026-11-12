import type { Field, Lesson } from "../types";
import inverter from "./pv-inverter.cid?raw";

/** The layers every MMS message rides in once the association is up: TPKT, COTP, session and presentation. */
const layers = (tpkt: string, tpktKey: string, presentation: string): Field[] => [
    [tpkt, "frame", tpktKey],
    ["02 F0 80", "frame", "cotp-dt"],
    ["01 00 01 00", "frame", "session"],
    [presentation, "frame", "presentation"],
];

export const lesson: Lesson = {
    actors: ["client", "pv1"],
    scene: {
        devices: [
            { id: "client", kind: "laptop", at: [0, 4], address: "10.0.0.5", active: true },
            { id: "pv1", kind: "inverter", at: [5, 1.5], address: "10.0.0.31", active: true },
            { id: "pv", kind: "pv", at: [8, -0.5] },
        ],
        links: [
            { id: "mms", from: "client", to: "pv1", label: "MMS · TCP 102", active: true },
            { id: "dc", from: "pv1", to: "pv", via: "y" },
        ],
    },
    steps: [{ id: "connect" }, { id: "associate" }, { id: "browse" }, { id: "read" }, { id: "report" }],
    frames: [
        { id: "tcp", step: "connect", from: "client", to: "pv1", kind: "TCP", name: "SYN · SYN-ACK · ACK", time: "0.000" },
        { id: "cotp-cr", step: "connect", from: "client", to: "pv1", kind: "COTP", name: "Connect Request", time: "0.004" },
        { id: "cotp-cc", step: "connect", from: "pv1", to: "client", kind: "COTP", name: "Connect Confirm", time: "0.009" },
        { id: "initiate-req", step: "associate", from: "client", to: "pv1", kind: "MMS", name: "Initiate-Request", time: "0.012" },
        { id: "initiate-resp", step: "associate", from: "pv1", to: "client", kind: "MMS", name: "Initiate-Response", time: "0.031" },
        { id: "names-req", step: "browse", from: "client", to: "pv1", kind: "MMS", name: "GetNameList · domains", time: "0.040" },
        { id: "names-resp", step: "browse", from: "pv1", to: "client", kind: "MMS", name: "GetNameList · response", time: "0.052" },
        {
            id: "read-req",
            step: "read",
            from: "client",
            to: "pv1",
            kind: "MMS",
            name: "Read · PV1INV/MMXU1$MX$TotW$mag$f",
            time: "0.061",
            fields: [
                ...layers("03 00 00 42", "tpkt-66", "61 35 30 33 02 01 03 A0 2E"),
                ["A0 2C", "type", "confirmed-req"],
                ["02 01 05", "control", "invoke"],
                ["A4 27", "type", "read"],
                ["A1 25 A0 23 30 21 A0 1F", "size", "spec"],
                ["A1 1D", "address", "domain-specific"],
                ["1A 06 50 56 31 49 4E 56", "address", "domain"],
                ["1A 13 4D 4D 58 55 31 24 4D 58 24 54 6F 74 57 24 6D 61 67 24 66", "address", "item"],
            ],
        },
        {
            id: "read-resp",
            step: "read",
            from: "pv1",
            to: "client",
            kind: "MMS",
            name: "Read · response",
            time: "0.068",
            fields: [
                ...layers("03 00 00 24", "tpkt-36", "61 17 30 15 02 01 03 A0 10"),
                ["A1 0E", "type", "confirmed-resp"],
                ["02 01 05", "control", "invoke-resp"],
                ["A4 09", "type", "read"],
                ["A1 07", "size", "results"],
                ["87 05", "type", "float-tag"],
                ["08", "size", "exponent"],
                ["45 96 A0 00", "value", "float"],
            ],
        },
        { id: "enable", step: "report", from: "client", to: "pv1", kind: "MMS", name: "Write · urcbMeas01$RptEna", time: "0.080" },
        { id: "report", step: "report", from: "pv1", to: "client", kind: "MMS", name: "InformationReport", time: "4.512" },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    points: {
        device: "pv1",
        receiver: "client",
        rows: [
            { id: "totw", address: "MMXU1.TotW.mag.f", values: [["connect", "4820.0", "–"], ["read", "4820.0", "4820.0"], ["report", "4790.5", "4790.5"]] },
            { id: "mult", address: "MMXU1.TotW.units", values: [["connect", "kW", "–"], ["browse", "kW", "kW"]] },
            { id: "hz", address: "MMXU1.Hz.mag.f", values: [["connect", "50.01", "–"], ["report", "50.00", "50.00"]] },
        ],
    },
    anatomy: [
        {
            id: "reference",
            parts: [
                ["PV1INV", "address", "a-ld"],
                ["MMXU1", "type", "a-ln"],
                ["MX", "cause", "a-fc"],
                ["TotW", "value", "a-do"],
                ["mag.f", "time", "a-da"],
            ],
            also: "PV1INV/MMXU1.TotW.mag.f [MX]  ·  MMS: PV1INV/MMXU1$MX$TotW$mag$f",
        },
    ],
    playground: [
        { kind: "scl", sample: "pv-inverter.cid", file: inverter },
        { kind: "encoder", type: "float32", order: "ABCD", value: 4820 },
    ],
    related: ["iec-61850-goose", "iec-61850-7-420", "iec-62351"],
};
