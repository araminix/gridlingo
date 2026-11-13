import type { Field, Lesson } from "../types";
import tables from "./tables.txt?raw";

/**
 * The header of a C12.18 packet: STP 0xEE, identity, control (with the toggle bit), sequence number and the data length.
 * The two CRC bytes that end every packet are left out of this lesson.
 */
const packet = (toggle: 0 | 1, length: string, key: string): Field[] => [
    ["EE", "frame", "stp"],
    ["00", "address", "identity"],
    [toggle ? "20" : "00", "control", toggle ? "ctrl-1" : "ctrl-0"],
    ["00", "control", "seq"],
    [length, "size", key],
];

/** A one-byte answer: 0x00, OK. */
const ok = (toggle: 0 | 1): Field[] => [...packet(toggle, "00 01", "len-1"), ["00", "cause", "ok"]];

export const lesson: Lesson = {
    actors: ["laptop", "meter", "headend"],
    scene: {
        devices: [
            { id: "laptop", kind: "laptop", at: [0, 4.5], active: true },
            { id: "meter", kind: "meter", at: [3, 1.5], active: true },
            { id: "relay", kind: "gateway", at: [6.5, 1.5], address: "C12.22 relay" },
            { id: "headend", kind: "scada", at: [6.5, 6.5], address: "10.30.0.9", active: true },
        ],
        links: [
            { id: "optical", from: "laptop", to: "meter", label: "C12.18 · optical", active: true },
            { id: "radio", from: "meter", to: "relay", radio: true },
            { id: "wan", from: "relay", to: "headend", label: "C12.22 · UDP 1153" },
        ],
    },
    steps: [{ id: "identify" }, { id: "logon" }, { id: "read" }, { id: "end" }, { id: "network" }],
    frames: [
        { id: "ident", step: "identify", from: "laptop", to: "meter", kind: "Request", name: "Identification · 0x20", time: "0.000", fields: [...packet(0, "00 01", "len-1"), ["20", "type", "ident"]] },
        { id: "ident-ok", step: "identify", from: "meter", to: "laptop", kind: "Response", name: "OK · C12.18", time: "0.030" },
        {
            id: "logon",
            step: "logon",
            from: "laptop",
            to: "meter",
            kind: "Request",
            name: "Logon · 0x50",
            time: "0.080",
            fields: [...packet(1, "00 0D", "len-13"), ["50", "type", "logon"], ["00 02", "address", "user-id"], ["54 45 43 48 30 31 20 20 20 20", "address", "user"]],
        },
        { id: "logon-ok", step: "logon", from: "meter", to: "laptop", kind: "Response", name: "OK", time: "0.110", fields: ok(1) },
        {
            id: "security",
            step: "logon",
            from: "laptop",
            to: "meter",
            kind: "Request",
            name: "Security · 0x51",
            time: "0.160",
            fields: [...packet(0, "00 15", "len-21"), ["51", "type", "security"], ["74 65 63 68 32 30 32 36 20 20 20 20 20 20 20 20 20 20 20 20", "security", "password"]],
        },
        { id: "security-ok", step: "logon", from: "meter", to: "laptop", kind: "Response", name: "OK", time: "0.200", fields: ok(0) },
        { id: "read", step: "read", from: "laptop", to: "meter", kind: "Request", name: "Full read · ST 23", time: "0.250", fields: [...packet(1, "00 03", "len-3"), ["30", "type", "read-full"], ["00 17", "address", "table-23"]] },
        {
            id: "table",
            step: "read",
            from: "meter",
            to: "laptop",
            kind: "Response",
            name: "OK · 12 bytes of ST 23",
            time: "0.290",
            fields: [
                ...packet(1, "00 10", "len-16"),
                ["00", "cause", "ok-read"],
                ["00 0C", "size", "count"],
                ["4E 61 BC 00 00 00", "value", "sum-0"],
                ["40 E2 01 00 00 00", "value", "sum-1"],
                ["72", "frame", "cksum"],
            ],
        },
        { id: "logoff", step: "end", from: "laptop", to: "meter", kind: "Request", name: "Logoff · 0x52", time: "0.340", fields: [...packet(0, "00 01", "len-1"), ["52", "type", "logoff"]] },
        { id: "logoff-ok", step: "end", from: "meter", to: "laptop", kind: "Response", name: "OK", time: "0.370", fields: ok(0) },
        { id: "terminate", step: "end", from: "laptop", to: "meter", kind: "Request", name: "Terminate · 0x21", time: "0.410", fields: [...packet(1, "00 01", "len-1"), ["21", "type", "terminate"]] },
        { id: "terminate-ok", step: "end", from: "meter", to: "laptop", kind: "Response", name: "OK", time: "0.440", fields: ok(1) },
        { id: "c1222-read", step: "network", from: "headend", to: "meter", kind: "C12.22", name: "ACSE · EPSEM · Full read ST 23", time: "900.000" },
        { id: "c1222-table", step: "network", from: "meter", to: "headend", kind: "C12.22", name: "ACSE · EPSEM · OK", time: "900.640" },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    points: {
        device: "meter",
        receiver: "laptop",
        rows: [
            { id: "session", address: "C12.18", values: [["identify", "~identified", "~identified"], ["logon", "~logged-on", "~logged-on"], ["end", "~closed", "~closed"]] },
            { id: "delivered", address: "ST 23 · 0", values: [["identify", "12345678 Wh", "–"], ["read", "12345678 Wh", "12345678 Wh"]] },
            { id: "received", address: "ST 23 · 1", values: [["identify", "123456 Wh", "–"], ["read", "123456 Wh", "123456 Wh"]] },
        ],
    },
    anatomy: [
        {
            id: "table",
            parts: [
                ["ST", "type", "t-st"],
                ["23", "address", "t-23"],
            ],
            also: "ST 23 = table 0x0017 on the wire  ·  MT 23 would be 2048 + 23 = 0x0817",
        },
    ],
    playground: [{ kind: "file", sample: "tables.txt", file: tables, notes: { 3: "st0", 4: "st1", 7: "procedures", 8: "st12", 10: "st21", 11: "st22", 12: "st23", 14: "mt" } }],
    related: ["dlms-cosem", "iec-62056-21", "ieee-2030-5"],
};
