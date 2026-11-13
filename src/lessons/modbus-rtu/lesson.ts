import type { Lesson } from "../types";
import line from "./line1.yaml?raw";

const SLAVES = ["inv1", "meter", "inv2"] as const;

export const lesson: Lesson = {
    actors: ["logger", "inv1", "meter", "inv2"],
    scene: {
        devices: [
            { id: "logger", kind: "gateway", at: [0, 4], address: "master", active: true },
            { id: "inv1", kind: "inverter", at: [4.6, 4], address: "slave 1", active: true },
            { id: "meter", kind: "meter", at: [4.6, 0.5], address: "slave 2", active: true },
            { id: "inv2", kind: "inverter", at: [8.4, 0.5], address: "slave 3", active: true },
        ],
        links: [
            { id: "bus1", from: "logger", to: "inv1", label: "RS-485 · 9600 8E1", active: true },
            { id: "bus2", from: "inv1", to: "meter", via: "y", active: true },
            { id: "bus3", from: "meter", to: "inv2", active: true },
        ],
    },
    steps: [{ id: "poll" }, { id: "meter" }, { id: "silent" }, { id: "broadcast" }, { id: "confirm" }],
    frames: [
        {
            id: "inv1-req",
            step: "poll",
            from: "logger",
            to: "inv1",
            kind: "Request",
            name: "Slave 1 · FC 04",
            time: "0.000",
            fields: [["01", "address", "slave-1"], ["04", "type", "fc04"], ["00 00", "address", "addr-0"], ["00 02", "size", "qty-2"], ["71 CB", "frame", "crc"]],
        },
        {
            id: "inv1-resp",
            step: "poll",
            from: "inv1",
            to: "logger",
            kind: "Response",
            name: "Slave 1 · FC 04 · 4 bytes",
            time: "0.020",
            fields: [["01", "address", "slave-1"], ["04", "type", "fc04"], ["04", "size", "count-4"], ["0C B2", "value", "power"], ["09 00", "value", "voltage"], ["5E A3", "frame", "crc"]],
        },
        {
            id: "meter-req",
            step: "meter",
            from: "logger",
            to: "meter",
            kind: "Request",
            name: "Slave 2 · FC 04",
            time: "0.040",
            fields: [["02", "address", "slave-2"], ["04", "type", "fc04"], ["00 0C", "address", "addr-12"], ["00 02", "size", "qty-2"], ["B1 FB", "frame", "crc"]],
        },
        {
            id: "meter-resp",
            step: "meter",
            from: "meter",
            to: "logger",
            kind: "Response",
            name: "Slave 2 · FC 04 · 4 bytes",
            time: "0.061",
            fields: [["02", "address", "slave-2"], ["04", "type", "fc04"], ["04", "size", "count-4"], ["45 33 78 00", "value", "meter-power"], ["0F 87", "frame", "crc"]],
        },
        {
            id: "inv2-req",
            step: "silent",
            from: "logger",
            to: "inv2",
            kind: "Request",
            name: "Slave 3 · FC 04",
            time: "0.080",
            fields: [["03", "address", "slave-3"], ["04", "type", "fc04"], ["00 00", "address", "addr-0"], ["00 02", "size", "qty-2"], ["70 29", "frame", "crc"]],
        },
        {
            id: "inv2-retry",
            step: "silent",
            from: "logger",
            to: "inv2",
            kind: "Retry",
            name: "Slave 3 · FC 04 · again",
            time: "1.089",
            fields: [["03", "address", "slave-3"], ["04", "type", "fc04"], ["00 00", "address", "addr-0"], ["00 02", "size", "qty-2"], ["70 29", "frame", "crc"]],
        },
        {
            id: "broadcast",
            step: "broadcast",
            from: "logger",
            to: SLAVES,
            kind: "Broadcast",
            name: "Address 0 · FC 06",
            time: "2.200",
            fields: [["00", "address", "slave-0"], ["06", "type", "fc06"], ["00 C8", "address", "addr-200"], ["00 3C", "value", "limit-60"], ["09 F4", "frame", "crc"]],
        },
        {
            id: "confirm-req",
            step: "confirm",
            from: "logger",
            to: "inv1",
            kind: "Request",
            name: "Slave 1 · FC 03",
            time: "2.410",
            fields: [["01", "address", "slave-1"], ["03", "type", "fc03"], ["00 C8", "address", "addr-200"], ["00 01", "size", "qty-1"], ["05 F4", "frame", "crc"]],
        },
        {
            id: "confirm-resp",
            step: "confirm",
            from: "inv1",
            to: "logger",
            kind: "Response",
            name: "Slave 1 · FC 03 · 2 bytes",
            time: "2.430",
            fields: [["01", "address", "slave-1"], ["03", "type", "fc03"], ["02", "size", "count-2"], ["00 3C", "value", "limit-60"], ["B8 55", "frame", "crc"]],
        },
    ],
    facts: ["standard", "between", "transport", "frames", "speed"],
    points: {
        device: "inv1",
        receiver: "logger",
        rows: [
            { id: "power", address: "30001", values: [["poll", "3250 W", "3250 W"]] },
            { id: "voltage", address: "30002", values: [["poll", "230.4 V", "230.4 V"]] },
            {
                id: "limit",
                address: "40201",
                values: [
                    ["poll", "100 %", "–"],
                    ["broadcast", "60 %", "~unconfirmed"],
                    ["confirm", "60 %", "60 %"],
                ],
            },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 60,
        ticks: [0, 10, 20, 30, 40, 50, 60],
        tracks: [
            {
                id: "logger",
                signal: [
                    [0, 1],
                    [9.17, 0],
                    [40, 1],
                    [49.17, 0],
                ],
            },
            {
                id: "inv1",
                signal: [
                    [0, 0],
                    [20, 1],
                    [30.31, 0],
                ],
            },
            {
                id: "idle",
                events: [
                    { t: 13.18, mark: "beat", label: "t35" },
                    { t: 34.32, mark: "beat" },
                    { t: 53.18, mark: "beat" },
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "register",
            parts: [
                ["3", "type", "r-table"],
                ["0013", "address", "r-number"],
            ],
            also: "30013 = FC 04, address 0x000C = 12 on the wire  ·  40013 would be FC 03",
        },
    ],
    playground: [{ kind: "file", sample: "line1.yaml", file: line, notes: { 3: "baud", 4: "parity", 6: "timeout", 7: "retries", 8: "after-broadcast", 10: "address", 12: "read", 13: "values", 14: "limit", 18: "float" } }],
    related: ["modbus-tcp", "sunspec", "iec-101"],
};
