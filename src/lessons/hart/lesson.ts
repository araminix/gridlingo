import type { Field, Lesson } from "../types";

// HART frames as the modem sends them: preamble, delimiter, address, command, byte count, (status,) data and the
// check byte, the XOR of everything after the preamble. Each byte goes on the line as 11 bits (8O1) at 1200 bit/s.
// The long address holds 14 bits of the expanded device type (0x2213) and the device ID (0x0A5E31) from command 0.
const PREAMBLE: Field = ["FF FF FF FF FF", "frame", "preamble"];
const ADDRESS: Field = ["A2 13 0A 5E 31", "address", "long"];

const request = (command: Field, count: Field, data: Field[], check: string): Field[] => [PREAMBLE, ["82", "control", "stx-long"], ADDRESS, command, count, ...data, [check, "frame", "check"]];

export const lesson: Lesson = {
    actors: ["laptop", "pt", "controller"],
    scene: {
        devices: [
            { id: "pt", kind: "sensor", at: [0, 0], address: "polling 0", active: true },
            { id: "controller", kind: "controller", at: [4.5, 0], address: "250 Ω input" },
            { id: "laptop", kind: "laptop", at: [0, 4], active: true },
        ],
        links: [
            { id: "loop", from: "pt", to: "controller", label: "4–20 mA · HART", active: true },
            { id: "clips", from: "laptop", to: "pt", via: "y" },
        ],
    },
    steps: [{ id: "analog" }, { id: "identify" }, { id: "read" }, { id: "test" }, { id: "release" }],
    frames: [
        { id: "analog", step: "analog", from: "pt", to: "controller", kind: "4–20 mA", name: "15.04 mA · 27.6 bar", time: "0.000" },
        {
            id: "cmd0",
            step: "identify",
            from: "laptop",
            to: "pt",
            kind: "HART",
            name: "Command 0 · Read unique identifier",
            time: "30.000",
            fields: [PREAMBLE, ["02", "control", "stx-short"], ["80", "address", "short"], ["00", "type", "cmd-0"], ["00", "size", "count-0"], ["82", "frame", "check"]],
        },
        { id: "cmd0-res", step: "identify", from: "pt", to: "laptop", kind: "HART", name: "Command 0 response · type 0x2213 · ID 0x0A5E31 · HART 7", time: "30.100" },
        {
            id: "cmd3",
            step: "read",
            from: "laptop",
            to: "pt",
            kind: "HART",
            name: "Command 3 · Read dynamic variables and loop current",
            time: "31.000",
            fields: request(["03", "type", "cmd-3"], ["00", "size", "count-0"], [], "55"),
        },
        {
            id: "cmd3-res",
            step: "read",
            from: "pt",
            to: "laptop",
            kind: "HART",
            name: "15.04 mA · 27.6 bar",
            time: "31.130",
            fields: [
                PREAMBLE,
                ["86", "control", "ack-long"],
                ADDRESS,
                ["03", "type", "cmd-3"],
                ["0B", "size", "count-11"],
                ["00", "cause", "response-ok"],
                ["00", "quality", "status-ok"],
                ["41 70 A3 D7", "value", "current"],
                ["07", "type", "unit-bar"],
                ["41 DC CC CD", "value", "pv"],
                ["84", "frame", "check"],
            ],
        },
        {
            id: "cmd40",
            step: "test",
            from: "laptop",
            to: "pt",
            kind: "HART",
            name: "Command 40 · Fixed current 12.000 mA",
            time: "60.000",
            fields: request(["28", "type", "cmd-40"], ["04", "size", "count-4"], [["41 40 00 00", "value", "fix-12"]], "7B"),
        },
        { id: "cmd40-res", step: "test", from: "pt", to: "laptop", kind: "HART", name: "Command 40 response · 12.000 mA · status 0x08", time: "60.120" },
        { id: "fixed", step: "test", from: "pt", to: "controller", kind: "4–20 mA", name: "12.000 mA · 20.0 bar", time: "60.200" },
        {
            id: "exit",
            step: "release",
            from: "laptop",
            to: "pt",
            kind: "HART",
            name: "Command 40 · 0 mA: leave fixed current",
            time: "120.000",
            fields: request(["28", "type", "cmd-40"], ["04", "size", "count-4"], [["00 00 00 00", "value", "fix-0"]], "7A"),
        },
        { id: "exit-res", step: "release", from: "pt", to: "laptop", kind: "HART", name: "Command 40 response · 0 mA · status 0x00", time: "120.120" },
        { id: "back", step: "release", from: "pt", to: "controller", kind: "4–20 mA", name: "15.04 mA · 27.6 bar", time: "120.200" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "pt",
        receiver: "controller",
        rows: [
            { id: "current", address: "4–20 mA", values: [["analog", "15.04 mA", "15.04 mA"], ["test", "12.000 mA", "12.000 mA"], ["release", "15.04 mA", "15.04 mA"]] },
            { id: "pressure", address: "PV", values: [["analog", "27.6 bar", "27.6 bar"], ["test", "27.6 bar", "20.0 bar"], ["release", "27.6 bar", "27.6 bar"]] },
        ],
    },
    timing: {
        unit: "s",
        scale: "linear",
        end: 150,
        ticks: [0, 30, 60, 90, 120, 150],
        tracks: [
            { id: "current", signal: [[0, (15.04 - 4) / 16], [60, (12 - 4) / 16], [120, (15.04 - 4) / 16]] },
            {
                id: "hart",
                events: [
                    { t: 30, mark: "repeat", label: "identify" },
                    { t: 60, mark: "event", label: "fix" },
                    { t: 120, mark: "event", label: "release" },
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "delimiter",
            parts: [
                ["1", "address", "d-long"],
                ["00", "size", "d-expansion"],
                ["00", "frame", "d-physical"],
                ["010", "type", "d-stx"],
            ],
            also: "0x82 = 1 00 00 010  ·  0x86 = 1 00 00 110 (ACK)  ·  0x02 = 0 00 00 010 (short address)",
        },
    ],
    playground: [{ kind: "encoder", type: "float32", order: "ABCD", value: 27.6 }],
    related: ["modbus-rtu", "profinet", "iec-61850-mms"],
};
