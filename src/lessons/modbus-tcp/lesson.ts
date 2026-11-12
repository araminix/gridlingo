import type { Field, Lesson } from "../types";
import registers from "./register-map.csv?raw";

const hex16 = (value: number) => [value >> 8, value & 0xff].map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");

/** The MBAP header that starts every Modbus TCP frame: transaction ID, protocol 0, the length of the rest, unit ID 1. */
const mbap = (transaction: number, length: number): Field[] => [
    [hex16(transaction), "control", `tid-${transaction}`],
    ["00 00", "frame", "proto"],
    [hex16(length), "size", `len-${length}`],
    ["01", "address", "unit"],
];

export const lesson: Lesson = {
    actors: ["controller", "inverter"],
    scene: {
        devices: [
            { id: "controller", kind: "controller", at: [0, 4], address: "10.0.0.5", active: true },
            { id: "inverter", kind: "inverter", at: [4.5, 1.5], address: "10.0.0.31 · unit 1", active: true },
            { id: "pv", kind: "pv", at: [7.5, -0.6] },
            { id: "meter", kind: "meter", at: [3, 6.5], address: "10.0.0.40" },
        ],
        links: [
            { id: "modbus", from: "controller", to: "inverter", label: "Modbus TCP · 502", active: true },
            { id: "dc", from: "inverter", to: "pv", via: "y" },
            { id: "grid", from: "controller", to: "meter", via: "y" },
        ],
    },
    steps: [{ id: "connect" }, { id: "read" }, { id: "limit" }, { id: "check" }, { id: "mistake" }],
    frames: [
        { id: "tcp", step: "connect", from: "controller", to: "inverter", kind: "TCP", name: "SYN · SYN-ACK · ACK", time: "0.000" },
        {
            id: "read-req",
            step: "read",
            from: "controller",
            to: "inverter",
            kind: "Request",
            name: "FC 03 · address 100 · 2 registers",
            time: "0.010",
            fields: [...mbap(1, 6), ["03", "type", "fc03"], ["00 64", "address", "addr-100"], ["00 02", "size", "qty-2"]],
        },
        {
            id: "read-resp",
            step: "read",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 03 · 4 bytes",
            time: "0.018",
            fields: [...mbap(1, 7), ["03", "type", "fc03"], ["04", "size", "count-4"], ["A4 00", "value", "reg-100"], ["45 96", "value", "reg-101"]],
        },
        {
            id: "write-req",
            step: "limit",
            from: "controller",
            to: "inverter",
            kind: "Request",
            name: "FC 06 · address 200 = 3000",
            time: "1.000",
            fields: [...mbap(2, 6), ["06", "type", "fc06"], ["00 C8", "address", "addr-200"], ["0B B8", "value", "limit-3000"]],
        },
        {
            id: "write-resp",
            step: "limit",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 06 · echo",
            time: "1.012",
            fields: [...mbap(2, 6), ["06", "type", "fc06-echo"], ["00 C8", "address", "addr-200"], ["0B B8", "value", "limit-3000"]],
        },
        {
            id: "check-req",
            step: "check",
            from: "controller",
            to: "inverter",
            kind: "Request",
            name: "FC 03 · address 100 · 2 registers",
            time: "6.000",
            fields: [...mbap(3, 6), ["03", "type", "fc03"], ["00 64", "address", "addr-100"], ["00 02", "size", "qty-2"]],
        },
        {
            id: "check-resp",
            step: "check",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 03 · 4 bytes",
            time: "6.009",
            fields: [...mbap(3, 7), ["03", "type", "fc03"], ["04", "size", "count-4"], ["6B 33", "value", "reg-100-later"], ["45 3B", "value", "reg-101-later"]],
        },
        {
            id: "wrong-req",
            step: "mistake",
            from: "controller",
            to: "inverter",
            kind: "Request",
            name: "FC 03 · address 40101",
            time: "7.000",
            fields: [...mbap(4, 6), ["03", "type", "fc03"], ["9C A5", "address", "addr-40101"], ["00 02", "size", "qty-2"]],
        },
        {
            id: "exception",
            step: "mistake",
            from: "inverter",
            to: "controller",
            kind: "Exception",
            name: "FC 83 · code 02",
            time: "7.006",
            fields: [...mbap(4, 3), ["83", "type", "fc83"], ["02", "cause", "code-02"]],
        },
    ],
    facts: ["standard", "between", "transport", "security", "frames", "since"],
    points: {
        device: "inverter",
        receiver: "controller",
        rows: [
            {
                id: "p",
                address: "40101",
                values: [
                    ["connect", "4820.5 kW", "–"],
                    ["read", "4820.5 kW", "4820.5 kW"],
                    ["limit", "2998.7 kW", "4820.5 kW"],
                    ["check", "2998.7 kW", "2998.7 kW"],
                ],
            },
            {
                id: "limit",
                address: "40201",
                values: [
                    ["connect", "5000 kW", "–"],
                    ["limit", "3000 kW", "3000 kW"],
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "register",
            parts: [
                ["4", "type", "a-table"],
                ["0101", "address", "a-number"],
            ],
            also: "40101  →  FC 03 · address 101 − 1 = 100 = 0x0064",
        },
    ],
    playground: [
        { kind: "encoder", type: "float32", order: "CDAB", value: 4820.5 },
        { kind: "file", sample: "register-map.csv", file: registers, notes: { 2: "unit", 3: "offset", 6: "float", 8: "scaled", 9: "uint32", 10: "limit", 11: "fallback" } },
    ],
    related: ["modbus-rtu", "sunspec", "modbus-security"],
};
