import type { Field, Lesson } from "../types";
import plan from "./midnight-read.json?raw";

/** The wrapper in front of every DLMS message on TCP: version 1, the source and destination wPort, the length of what follows. */
function wrapper(from: "client" | "meter", length: string, key: string): Field[] {
    return from === "client"
        ? [["00 01", "frame", "version"], ["00 11", "address", "src-client"], ["00 01", "address", "dst-meter"], [length, "size", key]]
        : [["00 01", "frame", "version"], ["00 01", "address", "src-meter"], ["00 11", "address", "dst-client"], [length, "size", key]];
}

/** The register this lesson reads: class 3, OBIS 1-0:1.8.0*255. */
const register: Field[] = [
    ["00 03", "type", "class-3"],
    ["01 00 01 08 00 FF", "address", "obis"],
];

export const lesson: Lesson = {
    actors: ["headend", "meter"],
    scene: {
        devices: [
            { id: "headend", kind: "scada", at: [-1.5, 2.5], address: "10.20.0.5", active: true },
            { id: "apn", kind: "cloud", at: [3.5, 2.5] },
            { id: "meter", kind: "meter", at: [7, 1], address: "10.64.12.7", active: true },
            { id: "meter2", kind: "meter", at: [6.5, 5], address: "10.64.12.8" },
        ],
        links: [
            { id: "wan", from: "headend", to: "apn", label: "DLMS · TCP 4059", active: true },
            { id: "cell", from: "apn", to: "meter", active: true },
            { id: "cell2", from: "apn", to: "meter2", via: "y" },
        ],
    },
    steps: [{ id: "connect" }, { id: "associate" }, { id: "value" }, { id: "scale" }, { id: "release" }],
    frames: [
        { id: "tcp", step: "connect", from: "headend", to: "meter", kind: "TCP", name: "SYN · SYN-ACK · ACK", time: "0.000" },
        {
            id: "aarq",
            step: "associate",
            from: "headend",
            to: "meter",
            kind: "ACSE",
            name: "AARQ · LLS",
            time: "0.240",
            fields: [
                ...wrapper("client", "00 38", "len-56"),
                ["60 36", "type", "aarq"],
                ["A1 09 06 07 60 85 74 05 08 01 01", "type", "context"],
                ["8A 02 07 80", "security", "acse-req"],
                ["8B 07 60 85 74 05 08 02 01", "security", "mech-lls"],
                ["AC 0A 80 08 31 32 33 34 35 36 37 38", "security", "password"],
                ["BE 10 04 0E", "frame", "user-info"],
                ["01 00 00 00", "type", "initiate-req"],
                ["06", "control", "dlms-version"],
                ["5F 1F 04 00 00 7E 1F", "control", "conformance-req"],
                ["FF FF", "size", "pdu-client"],
            ],
        },
        {
            id: "aare",
            step: "associate",
            from: "meter",
            to: "headend",
            kind: "ACSE",
            name: "AARE · accepted",
            time: "0.470",
            fields: [
                ...wrapper("meter", "00 2B", "len-43"),
                ["61 29", "type", "aare"],
                ["A1 09 06 07 60 85 74 05 08 01 01", "type", "context"],
                ["A2 03 02 01 00", "cause", "result"],
                ["A3 05 A1 03 02 01 00", "cause", "diagnostic"],
                ["BE 10 04 0E", "frame", "user-info"],
                ["08 00", "type", "initiate-resp"],
                ["06", "control", "dlms-version"],
                ["5F 1F 04 00 00 50 1F", "control", "conformance-resp"],
                ["01 F4", "size", "pdu-meter"],
                ["00 07", "address", "vaa"],
            ],
        },
        {
            id: "get-value",
            step: "value",
            from: "headend",
            to: "meter",
            kind: "xDLMS",
            name: "GET-Request-Normal · attribute 2",
            time: "0.680",
            fields: [...wrapper("client", "00 0D", "len-13"), ["C0 01", "type", "get-req"], ["C1", "control", "invoke-1"], ...register, ["02", "value", "attr-2"], ["00", "control", "no-selection"]],
        },
        {
            id: "value",
            step: "value",
            from: "meter",
            to: "headend",
            kind: "xDLMS",
            name: "GET-Response-Normal",
            time: "0.910",
            fields: [...wrapper("meter", "00 09", "len-9"), ["C4 01", "type", "get-resp"], ["C1", "control", "invoke-1-resp"], ["00", "cause", "data"], ["06", "type", "uint32"], ["00 12 D6 87", "value", "raw"]],
        },
        {
            id: "get-scaler",
            step: "scale",
            from: "headend",
            to: "meter",
            kind: "xDLMS",
            name: "GET-Request-Normal · attribute 3",
            time: "1.120",
            fields: [...wrapper("client", "00 0D", "len-13"), ["C0 01", "type", "get-req"], ["C2", "control", "invoke-2"], ...register, ["03", "value", "attr-3"], ["00", "control", "no-selection"]],
        },
        {
            id: "scaler",
            step: "scale",
            from: "meter",
            to: "headend",
            kind: "xDLMS",
            name: "GET-Response-Normal",
            time: "1.350",
            fields: [
                ...wrapper("meter", "00 0A", "len-10"),
                ["C4 01", "type", "get-resp"],
                ["C2", "control", "invoke-2-resp"],
                ["00", "cause", "data"],
                ["02 02", "type", "structure"],
                ["0F 01", "value", "scaler"],
                ["16 1E", "value", "unit"],
            ],
        },
        { id: "rlrq", step: "release", from: "headend", to: "meter", kind: "ACSE", name: "RLRQ", time: "1.560", fields: [...wrapper("client", "00 05", "len-5"), ["62 03", "type", "rlrq"], ["80 01 00", "cause", "reason"]] },
        { id: "rlre", step: "release", from: "meter", to: "headend", kind: "ACSE", name: "RLRE", time: "1.790", fields: [...wrapper("meter", "00 05", "len-5"), ["63 03", "type", "rlre"], ["80 01 00", "cause", "reason"]] },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    points: {
        device: "meter",
        receiver: "headend",
        rows: [
            { id: "association", address: "40.0.0", values: [["connect", "~none", "~none"], ["associate", "~lls", "~lls"], ["release", "~none", "~none"]] },
            { id: "raw", address: "1.8.0 · 2", values: [["connect", "1234567", "–"], ["value", "1234567", "1234567"]] },
            { id: "scaler", address: "1.8.0 · 3", values: [["connect", "×10 Wh", "–"], ["scale", "×10 Wh", "×10 Wh"]] },
            { id: "energy", address: "1.8.0", values: [["connect", "12345.67 kWh", "–"], ["scale", "12345.67 kWh", "12345.67 kWh"]] },
        ],
    },
    anatomy: [
        {
            id: "obis",
            parts: [
                ["1", "frame", "o-a"],
                ["0", "address", "o-b"],
                ["1", "type", "o-c"],
                ["8", "cause", "o-d"],
                ["0", "control", "o-e"],
                ["255", "time", "o-f"],
            ],
            also: "1-0:1.8.0*255  ·  bytes 01 00 01 08 00 FF  ·  display and IEC 62056-21: 1.8.0",
        },
    ],
    playground: [
        { kind: "file", sample: "midnight-read.json", file: plan, notes: { 4: "client", 6: "low", 9: "clock", 10: "register", 11: "keep", 13: "profile" } },
        { kind: "encoder", type: "uint32", order: "ABCD", value: 1234567 },
    ],
    related: ["iec-62056-21", "m-bus", "ansi-c12"],
};
