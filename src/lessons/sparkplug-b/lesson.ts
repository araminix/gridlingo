import type { Lesson } from "../types";
import dbirth from "./dbirth-inv1.json?raw";

export const lesson: Lesson = {
    actors: ["scada", "broker", "gw"],
    scene: {
        devices: [
            { id: "inv1", kind: "inverter", at: [-1, 1.5], address: "10.20.0.21" },
            { id: "gw", kind: "gateway", at: [3, 1.5], address: "10.20.0.5", active: true },
            { id: "broker", kind: "broker", at: [7.5, 1.5], address: "10.20.0.2", active: true },
            { id: "scada", kind: "scada", at: [11.5, 1.5], address: "10.20.0.10", active: true },
        ],
        links: [
            { id: "modbus", from: "inv1", to: "gw", label: "Modbus TCP" },
            { id: "edge", from: "gw", to: "broker", label: "MQTT · Sparkplug B", active: true },
            { id: "host", from: "broker", to: "scada", active: true },
        ],
    },
    steps: [{ id: "host" }, { id: "connect" }, { id: "birth" }, { id: "data" }, { id: "rebirth" }, { id: "death" }],
    frames: [
        { id: "host-connect", step: "host", from: "scada", to: "broker", kind: "CONNECT", name: "CONNECT · SCADA1 · will STATE", time: "0.000" },
        {
            id: "state",
            step: "host",
            from: "scada",
            to: "broker",
            kind: "STATE",
            name: "STATE · online · QoS 1 · retain",
            time: "0.012",
            fields: [
                ["33", "type", "publish-q1-retain"],
                ["41", "size", "rl-65"],
                ["00 14 73 70 42 76 31 2E 30 2F 53 54 41 54 45 2F 53 43 41 44 41 31", "address", "state-topic"],
                ["00 01", "control", "packet-id"],
                ["7B 22 6F 6E 6C 69 6E 65 22 3A 74 72 75 65 2C", "value", "state-online"],
                ["22 74 69 6D 65 73 74 61 6D 70 22 3A 31 37 39 34 34 38 30 30 30 30 30 30 30 7D", "time", "state-time"],
            ],
        },
        { id: "edge-connect", step: "connect", from: "gw", to: "broker", kind: "CONNECT", name: "CONNECT · GW1 · will NDEATH", time: "5.000" },
        { id: "state-seen", step: "connect", from: "broker", to: "gw", kind: "STATE", name: "STATE · online · retained", time: "5.008" },
        { id: "nbirth", step: "birth", from: "gw", to: "scada", kind: "NBIRTH", name: "NBIRTH · GW1 · seq 0 · bdSeq 0", time: "5.020" },
        { id: "dbirth", step: "birth", from: "gw", to: "scada", kind: "DBIRTH", name: "DBIRTH · INV1 · seq 1", time: "5.024" },
        {
            id: "ddata",
            step: "data",
            from: "gw",
            to: "scada",
            kind: "DDATA",
            name: "DDATA · INV1 · seq 2",
            time: "67.280",
            fields: [
                ["30", "type", "publish-q0"],
                ["3B", "size", "rl-59"],
                ["00 20 73 70 42 76 31 2E 30 2F 53 6F 6C 61 72 50 61 72 6B 2F 44 44 41 54 41 2F 47 57 31 2F 49 4E 56 31", "address", "ddata-topic"],
                ["08 D0 A5 E3 FA 9C 34", "time", "payload-time"],
                ["12 0E", "size", "metric"],
                ["10 02", "address", "alias"],
                ["18 B2 A5 E3 FA 9C 34", "time", "metric-time"],
                ["65 00 A4 96 45", "value", "float"],
                ["18 02", "control", "seq"],
            ],
        },
        { id: "ddata-gap", step: "rebirth", from: "gw", to: "scada", kind: "DDATA", name: "DDATA · INV1 · seq 4", time: "72.280" },
        { id: "ncmd", step: "rebirth", from: "scada", to: "gw", kind: "NCMD", name: "NCMD · Node Control/Rebirth", time: "74.290" },
        { id: "nbirth-again", step: "rebirth", from: "gw", to: "scada", kind: "NBIRTH", name: "NBIRTH · GW1 · bdSeq 0", time: "74.300" },
        { id: "dbirth-again", step: "rebirth", from: "gw", to: "scada", kind: "DBIRTH", name: "DBIRTH · INV1", time: "74.304" },
        { id: "ndeath", step: "death", from: "broker", to: "scada", kind: "NDEATH", name: "NDEATH · GW1 · bdSeq 0", time: "345.000" },
    ],
    facts: ["standard", "between", "transport", "security", "frames", "model"],
    points: {
        device: "gw",
        receiver: "scada",
        rows: [
            { id: "node", address: "GW1", values: [["host", "~offline", "~offline"], ["birth", "~online", "~online"], ["death", "~offline", "~offline"]] },
            {
                id: "power",
                address: "INV1 · AC/Power",
                values: [
                    ["host", "4790.0 kW", "–"],
                    ["birth", "4790.0 kW", "4790.0 kW"],
                    ["data", "4820.5 kW", "4820.5 kW"],
                    ["rebirth", "4835.0 kW", "4835.0 kW"],
                    ["death", "4835.0 kW", "4835.0 kW · STALE"],
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "topic",
            parts: [
                ["spBv1.0", "frame", "a-namespace"],
                ["SolarPark", "address", "a-group"],
                ["DDATA", "type", "a-type"],
                ["GW1", "address", "a-node"],
                ["INV1", "address", "a-device"],
            ],
            also: "spBv1.0/SolarPark/DDATA/GW1/INV1  ·  spBv1.0/SolarPark/NBIRTH/GW1  ·  spBv1.0/STATE/SCADA1",
        },
    ],
    playground: [{ kind: "file", sample: "dbirth-inv1.json", file: dbirth, notes: { 2: "payload-time", 4: "metric", 5: "double", 7: "string", 9: "seq" } }],
    related: ["mqtt", "opc-ua", "modbus-tcp"],
};
