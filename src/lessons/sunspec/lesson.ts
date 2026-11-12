import type { Field, Lesson } from "../types";
import models from "./models.json?raw";

const hex = (bytes: readonly number[]) => bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, "0")).join(" ");
const hex16 = (value: number) => hex([value >> 8, value & 0xff]);
/**
 * A SunSpec string: two ASCII characters a register, the first in the high byte, filled up with zeros. Shown 4 registers
 * at a time: the first run names the string, the runs of zeros after it are the fill.
 */
function string(value: string, registers: number, key: string): Field[] {
    const bytes = Array.from({ length: registers * 2 }, (_, i) => value.charCodeAt(i) || 0);
    return Array.from({ length: registers / 4 }, (_, i) => {
        const run = bytes.slice(i * 8, i * 8 + 8);
        return i && run.every((byte) => byte === 0) ? [hex(run), "frame", "fill"] : [hex(run), "value", key];
    });
}

/** The MBAP header of a Modbus TCP frame to unit 1: transaction ID, protocol 0, the length of the rest. */
const mbap = (transaction: number, length: number): Field[] => [
    [hex16(transaction), "control", `tid-${transaction}`],
    ["00 00", "frame", "proto"],
    [hex16(length), "size", `len-${length}`],
    ["01", "address", "unit"],
];

/** Read holding registers (FC 03): from an address, so many. */
const read = (transaction: number, address: number, count: number): Field[] => [
    ...mbap(transaction, 6),
    ["03", "type", "fc03"],
    [hex16(address), "address", `addr-${address}`],
    [hex16(count), "size", `qty-${count}`],
];

/** The answer to a read: the byte count, then the registers. */
const answer = (transaction: number, data: Field[]): Field[] => {
    const count = data.reduce((sum, [bytes]) => sum + bytes.split(" ").length, 0);
    return [...mbap(transaction, count + 3), ["03", "type", "fc03"], [hex([count]), "size", `count-${count}`], ...data];
};

export const lesson: Lesson = {
    actors: ["controller", "inverter"],
    scene: {
        devices: [
            { id: "controller", kind: "controller", at: [0, 4], address: "10.0.0.5", active: true },
            { id: "inverter", kind: "inverter", at: [5.5, 1.5], address: "10.0.0.31 · unit 1", active: true },
            { id: "pv", kind: "pv", at: [8.5, -0.6] },
            { id: "battery", kind: "battery", at: [2.6, 7.6], address: "10.0.0.32" },
        ],
        links: [
            { id: "modbus", from: "controller", to: "inverter", label: "SunSpec · Modbus TCP 502", active: true },
            { id: "dc", from: "inverter", to: "pv", via: "y" },
            { id: "bess", from: "controller", to: "battery", via: "y" },
        ],
    },
    steps: [{ id: "find" }, { id: "common" }, { id: "walk" }, { id: "read" }, { id: "end" }],
    frames: [
        { id: "sid-req", step: "find", from: "controller", to: "inverter", kind: "Request", name: "FC 03 · 40000 · 2 registers", time: "0.000", fields: read(1, 40000, 2) },
        { id: "sid-resp", step: "find", from: "inverter", to: "controller", kind: "Response", name: "FC 03 · \"SunS\"", time: "0.008", fields: answer(1, [["53 75 6E 53", "value", "suns"]]) },
        { id: "common-req", step: "common", from: "controller", to: "inverter", kind: "Request", name: "FC 03 · 40002 · 68 registers", time: "0.015", fields: read(2, 40002, 68) },
        {
            id: "common-resp",
            step: "common",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 03 · model 1",
            time: "0.031",
            fields: answer(2, [
                ["00 01", "type", "id-1"],
                ["00 42", "size", "l-66"],
                ...string("Example", 16, "mn"),
                ...string("EX-5K-3P", 16, "md"),
                ...string("", 8, "opt"),
                ...string("3.4.1", 8, "vr"),
                ...string("24110042", 16, "sn"),
                ["00 01", "address", "da"],
                ["00 00", "frame", "pad"],
            ]),
        },
        { id: "hdr-req", step: "walk", from: "controller", to: "inverter", kind: "Request", name: "FC 03 · 40070 · 2 registers", time: "0.040", fields: read(3, 40070, 2) },
        {
            id: "hdr-resp",
            step: "walk",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 03 · ID 103 · L 50",
            time: "0.048",
            fields: answer(3, [
                ["00 67", "type", "id-103"],
                ["00 32", "size", "l-50"],
            ]),
        },
        { id: "values-req", step: "read", from: "controller", to: "inverter", kind: "Request", name: "FC 03 · 40084 · 4 registers", time: "0.055", fields: read(4, 40084, 4) },
        {
            id: "values-resp",
            step: "read",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 03 · W, W_SF, Hz, Hz_SF",
            time: "0.063",
            fields: answer(4, [
                ["12 D4", "value", "w"],
                ["00 00", "type", "w-sf"],
                ["13 89", "value", "hz"],
                ["FF FE", "type", "hz-sf"],
            ]),
        },
        { id: "end-req", step: "end", from: "controller", to: "inverter", kind: "Request", name: "FC 03 · 40122 · 2 registers", time: "0.070", fields: read(5, 40122, 2) },
        {
            id: "end-resp",
            step: "end",
            from: "inverter",
            to: "controller",
            kind: "Response",
            name: "FC 03 · ID 0xFFFF",
            time: "0.078",
            fields: answer(5, [
                ["FF FF", "type", "id-end"],
                ["00 00", "size", "l-0"],
            ]),
        },
    ],
    facts: ["standard", "between", "transport", "model", "frames"],
    points: {
        device: "inverter",
        receiver: "controller",
        rows: [
            { id: "marker", address: "40000", values: [["find", "SunS", "SunS"]] },
            {
                id: "models",
                address: "40002 …",
                values: [
                    ["find", "1, 103", "–"],
                    ["common", "1, 103", "1"],
                    ["walk", "1, 103", "1, 103"],
                ],
            },
            {
                id: "maker",
                address: "40004",
                values: [
                    ["find", "Example", "–"],
                    ["common", "Example", "Example"],
                ],
            },
            {
                id: "w",
                address: "40084",
                values: [
                    ["find", "4820 W", "–"],
                    ["read", "4820 W", "4820 W"],
                ],
            },
            {
                id: "hz",
                address: "40086",
                values: [
                    ["find", "50.01 Hz", "–"],
                    ["read", "50.01 Hz", "50.01 Hz"],
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "header",
            parts: [
                ["40070", "address", "a-at"],
                ["103", "type", "a-id"],
                ["50", "size", "a-l"],
                ["40072 … 40121", "value", "a-body"],
                ["40122", "address", "a-next"],
            ],
            also: "next header = 40070 + 2 + 50 = 40122",
        },
        {
            id: "scale",
            parts: [
                ["5001", "value", "a-raw"],
                ["−2", "type", "a-sf"],
                ["50.01 Hz", "value", "a-real"],
            ],
            also: "Hz × 10^Hz_SF = 5001 × 10^−2 = 50.01",
        },
    ],
    playground: [{ kind: "file", sample: "models.json", file: models, notes: { 3: "unit", 4: "base", 5: "marker", 7: "common", 9: "model", 12: "length", 14: "w", 15: "sf", 18: "acc", 22: "end" } }],
    related: ["modbus-tcp", "ieee-2030-5", "iec-61850-7-420"],
};
