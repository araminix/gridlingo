import type { Field, Lesson } from "../types";
import settings from "./rtu-101.json?raw";

/** A fixed-length FT 1.2 frame to or from link address 1: start, control, address, checksum, end. */
const fixed = (control: string, key: string, checksum: string): Field[] => [
    ["10", "frame", "start-fixed"],
    [control, "control", key],
    ["01", "address", "link"],
    [checksum, "frame", "cs-fixed"],
    ["16", "frame", "end"],
];

/** The start of a variable-length frame (68 L L 68), then its control field and link address 1. */
const head = (length: string, control: string, key: string): Field[] => [
    [`68 ${length} ${length} 68`, "frame", `head-${parseInt(length, 16)}`],
    [control, "control", key],
    ["01", "address", "link"],
];

/** The ASDU of a general interrogation, with the cause given: 1-byte cause, 1-byte common address, 2-byte IOA. */
const interrogation = (cause: string, key: string): Field[] => [
    ["64", "type", "type100"],
    ["01", "size", "vsq1"],
    [cause, "cause", key],
    ["01", "address", "ca"],
    ["00 00", "address", "ioa0"],
    ["14", "value", "qoi20"],
];

const end = (checksum: string): Field[] => [
    [checksum, "frame", "cs-var"],
    ["16", "frame", "end"],
];

export const lesson: Lesson = {
    actors: ["scada", "rtu"],
    scene: {
        devices: [
            { id: "scada", kind: "scada", at: [0, 3], active: true },
            { id: "radio-cc", kind: "radio", at: [3.5, 3] },
            { id: "radio-rtu", kind: "radio", at: [7.5, 3] },
            { id: "rtu", kind: "rtu", at: [10, 3], address: "link 1 · CA 1", active: true },
            { id: "cb1", kind: "breaker", at: [13, 3], address: "IOA 2001" },
            { id: "cb2", kind: "breaker", at: [10, 6], address: "IOA 2002" },
        ],
        links: [
            { id: "modem-cc", from: "scada", to: "radio-cc", active: true },
            { id: "air", from: "radio-cc", to: "radio-rtu", label: "IEC 101 · 9600 bit/s", radio: true, active: true },
            { id: "modem-rtu", from: "radio-rtu", to: "rtu", active: true },
            { id: "cb1", from: "rtu", to: "cb1" },
            { id: "cb2", from: "rtu", to: "cb2", via: "y" },
        ],
    },
    steps: [{ id: "link" }, { id: "ask" }, { id: "values" }, { id: "trip" }],
    frames: [
        { id: "reset", step: "link", from: "scada", to: "rtu", kind: "Fixed", name: "FC 0 · Reset remote link", time: "0.000", fields: fixed("40", "c-reset", "41") },
        { id: "reset-ack", step: "link", from: "rtu", to: "scada", kind: "Fixed", name: "FC 0 · ACK", time: "0.044", fields: fixed("00", "c-ack", "01") },
        {
            id: "gi-act",
            step: "ask",
            from: "scada",
            to: "rtu",
            kind: "Var",
            name: "SEND/CONFIRM · C_IC_NA_1 act",
            time: "0.084",
            fields: [...head("09", "73", "c-send"), ...interrogation("06", "cot6"), ...end("F4")],
        },
        { id: "gi-ack", step: "ask", from: "rtu", to: "scada", kind: "Fixed", name: "FC 0 · ACK · ACD 1", time: "0.140", fields: fixed("20", "c-ack-acd", "21") },
        { id: "poll-1", step: "values", from: "scada", to: "rtu", kind: "Fixed", name: "FC 10 · Request class 1", time: "0.180", fields: fixed("5A", "c-class1-fcb0", "5B") },
        {
            id: "gi-con",
            step: "values",
            from: "rtu",
            to: "scada",
            kind: "Var",
            name: "C_IC_NA_1 · actcon",
            time: "0.224",
            fields: [...head("09", "28", "c-data-acd"), ...interrogation("07", "cot7"), ...end("AA")],
        },
        { id: "poll-2", step: "values", from: "scada", to: "rtu", kind: "Fixed", name: "FC 10 · Request class 1", time: "0.276", fields: fixed("7A", "c-class1-fcb1", "7B") },
        {
            id: "states",
            step: "values",
            from: "rtu",
            to: "scada",
            kind: "Var",
            name: "M_DP_NA_1 · inrogen",
            time: "0.320",
            fields: [
                ...head("0C", "28", "c-data-acd"),
                ["03", "type", "type3"],
                ["02", "size", "vsq2"],
                ["14", "cause", "cot20"],
                ["01", "address", "ca"],
                ["D1 07", "address", "ioa2001"],
                ["02", "value", "diq-on"],
                ["D2 07", "address", "ioa2002"],
                ["02", "value", "diq-on"],
                ...end("F8"),
            ],
        },
        { id: "poll-3", step: "values", from: "scada", to: "rtu", kind: "Fixed", name: "FC 10 · Request class 1", time: "0.376", fields: fixed("5A", "c-class1-fcb0", "5B") },
        {
            id: "gi-term",
            step: "values",
            from: "rtu",
            to: "scada",
            kind: "Var",
            name: "C_IC_NA_1 · actterm",
            time: "0.419",
            fields: [...head("09", "08", "c-data"), ...interrogation("0A", "cot10"), ...end("8D")],
        },
        { id: "poll-class2", step: "trip", from: "scada", to: "rtu", kind: "Fixed", name: "FC 11 · Request class 2", time: "2.000", fields: fixed("7B", "c-class2-fcb1", "7C") },
        { id: "no-data", step: "trip", from: "rtu", to: "scada", kind: "Fixed", name: "FC 9 · No data · ACD 1", time: "2.044", fields: fixed("29", "c-no-data-acd", "2A") },
        { id: "poll-4", step: "trip", from: "scada", to: "rtu", kind: "Fixed", name: "FC 10 · Request class 1", time: "2.084", fields: fixed("5A", "c-class1-fcb0", "5B") },
        {
            id: "trip",
            step: "trip",
            from: "rtu",
            to: "scada",
            kind: "Var",
            name: "M_DP_TB_1 · spont",
            time: "2.128",
            fields: [
                ...head("10", "08", "c-data"),
                ["1F", "type", "type31"],
                ["01", "size", "vsq1"],
                ["03", "cause", "cot3"],
                ["01", "address", "ca"],
                ["D1 07", "address", "ioa2001"],
                ["01", "value", "diq-off"],
                ["70 1C 29 0A 8C 0B 1A", "time", "cp56"],
                ...end("76"),
            ],
        },
    ],
    facts: ["standard", "between", "transport", "security", "frames", "speed"],
    points: {
        device: "rtu",
        receiver: "scada",
        rows: [
            { id: "cb1", address: "2001", values: [["link", "~closed", "–"], ["values", "~closed", "~closed"], ["trip", "~open", "~open"]] },
            { id: "cb2", address: "2002", values: [["link", "~closed", "–"], ["values", "~closed", "~closed"]] },
        ],
    },
    anatomy: [
        {
            id: "primary",
            parts: [
                ["0", "frame", "a-res"],
                ["1", "cause", "a-prm1"],
                ["1", "control", "a-fcb"],
                ["1", "quality", "a-fcv"],
                ["0011", "type", "a-fc3"],
            ],
            also: "0x73 = 0111 0011",
        },
        {
            id: "secondary",
            parts: [
                ["0", "frame", "a-res"],
                ["0", "cause", "a-prm0"],
                ["1", "control", "a-acd"],
                ["0", "quality", "a-dfc"],
                ["1000", "type", "a-fc8"],
            ],
            also: "0x28 = 0010 1000",
        },
    ],
    playground: [{ kind: "file", sample: "rtu-101.json", file: settings, notes: { 4: "baud", 5: "format", 6: "mode", 8: "link-address", 9: "sizes", 15: "common-address", 17: "class2", 18: "timeout", 23: "ioa", 26: "class", 27: "spontaneous", 28: "time" } }],
    related: ["iec-104", "iec-103", "dnp3"],
};
