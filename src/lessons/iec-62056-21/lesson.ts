import type { Field, Lesson } from "../types";

/** "/?!" CR LF: the sign-on, at 300 baud. */
const signOn: Field[] = [
    ["2F", "frame", "slash"],
    ["3F", "type", "request"],
    ["21", "frame", "end-request"],
    ["0D 0A", "frame", "crlf"],
];

/** "/EXA5EM340" CR LF: the meter's identification. */
const identification: Field[] = [
    ["2F", "frame", "slash"],
    ["45 58 41", "address", "maker"],
    ["35", "control", "baud-5"],
    ["45 4D 33 34 30", "type", "model"],
    ["0D 0A", "frame", "crlf"],
];

/** ACK, protocol 0, speed 5 (9600 baud), then the mode: "0" readout or "1" programming. */
const select = (mode: "30" | "31"): Field[] => [
    ["06", "control", "ack"],
    ["30", "control", "protocol"],
    ["35", "control", "speed"],
    [mode, "type", mode === "30" ? "mode-readout" : "mode-program"],
    ["0D 0A", "frame", "crlf"],
];

export const lesson: Lesson = {
    actors: ["laptop", "meter"],
    scene: {
        devices: [
            { id: "laptop", kind: "laptop", at: [0, 3.5], active: true },
            { id: "meter", kind: "meter", at: [4, 0.5], active: true },
            { id: "house", kind: "building", at: [7.5, 1.5] },
        ],
        links: [
            { id: "probe", from: "laptop", to: "meter", label: "IEC 62056-21 · optical", active: true },
            { id: "supply", from: "meter", to: "house" },
        ],
    },
    steps: [{ id: "signon" }, { id: "select" }, { id: "readout" }, { id: "program" }, { id: "password" }, { id: "read" }],
    frames: [
        { id: "signon", step: "signon", from: "laptop", to: "meter", kind: "Request", name: "/?!", time: "0.000", fields: signOn },
        { id: "ident", step: "signon", from: "meter", to: "laptop", kind: "Ident", name: "/EXA5EM340", time: "0.400", fields: identification },
        { id: "ack-readout", step: "select", from: "laptop", to: "meter", kind: "ACK", name: "ACK 0 5 0", time: "1.050", fields: select("30") },
        {
            id: "data",
            step: "readout",
            from: "meter",
            to: "laptop",
            kind: "Data",
            name: "STX … ! ETX BCC",
            time: "1.480",
            fields: [
                ["02", "frame", "stx"],
                ["31 2E 38 2E 30", "address", "a-180"],
                ["28 30 31 32 33 34 35 2E 36 37 38 2A 6B 57 68 29", "value", "v-180"],
                ["0D 0A", "frame", "crlf"],
                ["31 2E 38 2E 31", "address", "a-181"],
                ["28 30 30 38 37 36 35 2E 34 33 32 2A 6B 57 68 29", "value", "v-181"],
                ["0D 0A", "frame", "crlf"],
                ["31 2E 38 2E 32", "address", "a-182"],
                ["28 30 30 33 35 38 30 2E 32 34 36 2A 6B 57 68 29", "value", "v-182"],
                ["0D 0A", "frame", "crlf"],
                ["21 0D 0A", "frame", "end-data"],
                ["03", "frame", "etx"],
                ["76", "frame", "bcc-data"],
            ],
        },
        { id: "signon-2", step: "program", from: "laptop", to: "meter", kind: "Request", name: "/?!", time: "5.000", fields: signOn },
        { id: "ident-2", step: "program", from: "meter", to: "laptop", kind: "Ident", name: "/EXA5EM340", time: "5.400", fields: identification },
        { id: "ack-program", step: "program", from: "laptop", to: "meter", kind: "ACK", name: "ACK 0 5 1", time: "6.050", fields: select("31") },
        {
            id: "p0",
            step: "program",
            from: "meter",
            to: "laptop",
            kind: "Command",
            name: "SOH P0 STX (…) ETX BCC",
            time: "6.480",
            fields: [["01", "frame", "soh"], ["50 30", "type", "p0"], ["02", "frame", "stx-command"], ["28 38 37 36 35 34 33 32 31 29", "value", "operand"], ["03", "frame", "etx"], ["68", "frame", "bcc-p0"]],
        },
        {
            id: "p1",
            step: "password",
            from: "laptop",
            to: "meter",
            kind: "Command",
            name: "SOH P1 STX (…) ETX BCC",
            time: "6.720",
            fields: [["01", "frame", "soh"], ["50 31", "type", "p1"], ["02", "frame", "stx-command"], ["28 31 38 32 37 33 36 34 35 29", "security", "password"], ["03", "frame", "etx"], ["69", "frame", "bcc-p1"]],
        },
        { id: "ack-password", step: "password", from: "meter", to: "laptop", kind: "ACK", name: "ACK", time: "6.950", fields: [["06", "control", "ack-password"]] },
        {
            id: "r1",
            step: "read",
            from: "laptop",
            to: "meter",
            kind: "Command",
            name: "SOH R1 STX 2.8.0() ETX BCC",
            time: "7.200",
            fields: [["01", "frame", "soh"], ["52 31", "type", "r1"], ["02", "frame", "stx-command"], ["32 2E 38 2E 30 28 29", "address", "ask-280"], ["03", "frame", "etx"], ["59", "frame", "bcc-r1"]],
        },
        {
            id: "answer",
            step: "read",
            from: "meter",
            to: "laptop",
            kind: "Data",
            name: "STX 2.8.0(…) ETX BCC",
            time: "7.430",
            fields: [["02", "frame", "stx"], ["32 2E 38 2E 30", "address", "a-280"], ["28 30 30 30 31 32 33 2E 34 35 36 2A 6B 57 68 29", "value", "v-280"], ["03", "frame", "etx"], ["5F", "frame", "bcc-answer"]],
        },
        { id: "b0", step: "read", from: "laptop", to: "meter", kind: "Command", name: "SOH B0 ETX BCC", time: "7.700", fields: [["01", "frame", "soh"], ["42 30", "type", "b0"], ["03", "frame", "etx"], ["71", "frame", "bcc-b0"]] },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "meter",
        receiver: "laptop",
        rows: [
            { id: "speed", address: "baud", values: [["signon", "300", "300"], ["select", "9600", "9600"], ["read", "300", "300"]] },
            { id: "import", address: "1.8.0", values: [["signon", "12345.678 kWh", "–"], ["readout", "12345.678 kWh", "12345.678 kWh"]] },
            { id: "export", address: "2.8.0", values: [["signon", "123.456 kWh", "–"], ["read", "123.456 kWh", "123.456 kWh"]] },
        ],
    },
    anatomy: [
        {
            id: "line",
            parts: [
                ["1", "type", "l-c"],
                ["8", "cause", "l-d"],
                ["0", "control", "l-e"],
                ["012345.678", "value", "l-value"],
                ["kWh", "size", "l-unit"],
            ],
            also: "1.8.0(012345.678*kWh)  ·  in DLMS: OBIS 1-0:1.8.0*255",
        },
    ],
    related: ["dlms-cosem", "m-bus", "ansi-c12"],
};
