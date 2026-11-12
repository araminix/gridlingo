import type { Field, Lesson } from "../types";
import broker from "./mosquitto.conf?raw";

/** The topic plant/gw1/status, with its two length bytes. */
const STATUS: Field = ["00 10 70 6C 61 6E 74 2F 67 77 31 2F 73 74 61 74 75 73", "address", "topic-status"];

/** The JSON payload of inverter 1's telemetry, cut where its meaning changes. */
const TELEMETRY: Field[] = [
    ["7B 22 74 73 22 3A 22 32 30 32 36 2D 31 31 2D 31 32 54 31 30 3A 34 31 3A 30 37 2E 32 38 30 5A 22 2C", "time", "json-ts"],
    ["22 70 5F 6B 77 22 3A 34 38 32 30 2E 35 2C 22 71 5F 6B 76 61 72 22 3A 36 31 30 2E 32 2C 22 75 5F 76 22 3A 32 30 31 35 30 2C 22 66 5F 68 7A 22 3A 35 30 2E 30 31 2C", "value", "json-values"],
    ["22 73 74 61 74 65 22 3A 22 72 75 6E 6E 69 6E 67 22 7D", "value", "json-state"],
];

/** A PUBLISH of the telemetry at QoS 1, with the packet id the sender picked. */
const telemetry = (id: Field): Field[] => [["32", "type", "publish-q1"], ["81 01", "size", "rl-129"], ["00 14 70 6C 61 6E 74 2F 69 6E 76 31 2F 74 65 6C 65 6D 65 74 72 79", "address", "topic-telemetry"], id, ...TELEMETRY];

/** A PUBACK for a packet id. */
const puback = (id: Field): Field[] => [["40", "type", "puback"], ["02", "size", "rl-2"], id];

export const lesson: Lesson = {
    actors: ["gateway", "broker", "dashboard"],
    scene: {
        devices: [
            { id: "inv1", kind: "inverter", at: [-1, 0] },
            { id: "inv2", kind: "inverter", at: [-1, 3] },
            { id: "gateway", kind: "gateway", at: [3, 1.5], address: "10.20.0.5", active: true },
            { id: "broker", kind: "broker", at: [7, 1.5], address: "10.20.0.2", active: true },
            { id: "dashboard", kind: "scada", at: [11, 1.5], address: "10.20.0.30", active: true },
        ],
        links: [
            { id: "modbus1", from: "inv1", to: "gateway", label: "Modbus TCP", via: "y" },
            { id: "modbus2", from: "inv2", to: "gateway", via: "y" },
            { id: "mqtt-gw", from: "gateway", to: "broker", label: "MQTT · TCP 1883", active: true },
            { id: "mqtt-dash", from: "broker", to: "dashboard", active: true },
        ],
    },
    steps: [{ id: "connect" }, { id: "online" }, { id: "subscribe" }, { id: "publish" }, { id: "keepalive" }, { id: "lost" }],
    frames: [
        {
            id: "connect",
            step: "connect",
            from: "gateway",
            to: "broker",
            kind: "CONNECT",
            name: "CONNECT · plant-gw1 · will",
            time: "0.000",
            fields: [
                ["10", "type", "connect"],
                ["3F", "size", "rl-63"],
                ["00 04 4D 51 54 54", "frame", "protocol"],
                ["04", "control", "level"],
                ["EE", "control", "flags"],
                ["00 3C", "time", "keepalive"],
                ["00 09 70 6C 61 6E 74 2D 67 77 31", "address", "client-id"],
                ["00 10 70 6C 61 6E 74 2F 67 77 31 2F 73 74 61 74 75 73", "address", "will-topic"],
                ["00 07 6F 66 66 6C 69 6E 65", "value", "will-message"],
                ["00 03 67 77 31", "security", "username"],
                ["00 08 47 77 31 2D 70 34 73 73", "security", "password"],
            ],
        },
        { id: "connack", step: "connect", from: "broker", to: "gateway", kind: "CONNACK", name: "CONNACK · accepted", time: "0.006", fields: [["20", "type", "connack"], ["02", "size", "rl-2"], ["00", "control", "session-present"], ["00", "cause", "return-code"]] },
        {
            id: "online",
            step: "online",
            from: "gateway",
            to: "broker",
            kind: "PUBLISH",
            name: "PUBLISH · QoS 1 · retain · id 1",
            time: "0.009",
            fields: [["33", "type", "publish-q1-retain"], ["1A", "size", "rl-26"], STATUS, ["00 01", "control", "id-1-gateway"], ["6F 6E 6C 69 6E 65", "value", "online"]],
        },
        { id: "online-ack", step: "online", from: "broker", to: "gateway", kind: "PUBACK", name: "PUBACK · id 1", time: "0.012", fields: puback(["00 01", "control", "id-1-ack"]) },
        {
            id: "subscribe",
            step: "subscribe",
            from: "dashboard",
            to: "broker",
            kind: "SUBSCRIBE",
            name: "SUBSCRIBE · id 1 · 2 filters",
            time: "8.150",
            fields: [
                ["82", "type", "subscribe"],
                ["27", "size", "rl-39"],
                ["00 01", "control", "id-1-subscribe"],
                ["00 11 70 6C 61 6E 74 2F 2B 2F 74 65 6C 65 6D 65 74 72 79", "address", "filter-telemetry"],
                ["01", "quality", "want-qos-1"],
                ["00 0E 70 6C 61 6E 74 2F 2B 2F 73 74 61 74 75 73", "address", "filter-status"],
                ["00", "quality", "want-qos-0"],
            ],
        },
        { id: "suback", step: "subscribe", from: "broker", to: "dashboard", kind: "SUBACK", name: "SUBACK · id 1", time: "8.153", fields: [["90", "type", "suback"], ["04", "size", "rl-4"], ["00 01", "control", "id-1-suback"], ["01 00", "quality", "granted"]] },
        {
            id: "retained",
            step: "subscribe",
            from: "broker",
            to: "dashboard",
            kind: "PUBLISH",
            name: "PUBLISH · QoS 0 · retain",
            time: "8.154",
            fields: [["31", "type", "publish-q0-retain"], ["18", "size", "rl-24"], STATUS, ["6F 6E 6C 69 6E 65", "value", "online-kept"]],
        },
        { id: "publish", step: "publish", from: "gateway", to: "broker", kind: "PUBLISH", name: "PUBLISH · QoS 1 · id 2", time: "15.000", fields: telemetry(["00 02", "control", "id-2-gateway"]) },
        { id: "publish-ack", step: "publish", from: "broker", to: "gateway", kind: "PUBACK", name: "PUBACK · id 2", time: "15.003", fields: puback(["00 02", "control", "id-2-ack"]) },
        { id: "forward", step: "publish", from: "broker", to: "dashboard", kind: "PUBLISH", name: "PUBLISH · QoS 1 · id 1", time: "15.004", fields: telemetry(["00 01", "control", "id-1-broker"]) },
        { id: "forward-ack", step: "publish", from: "dashboard", to: "broker", kind: "PUBACK", name: "PUBACK · id 1", time: "15.010", fields: puback(["00 01", "control", "id-1-dashboard"]) },
        { id: "ping", step: "keepalive", from: "gateway", to: "broker", kind: "PINGREQ", name: "PINGREQ", time: "75.000", fields: [["C0", "type", "pingreq"], ["00", "size", "rl-0"]] },
        { id: "pong", step: "keepalive", from: "broker", to: "gateway", kind: "PINGRESP", name: "PINGRESP", time: "75.002", fields: [["D0", "type", "pingresp"], ["00", "size", "rl-0"]] },
        {
            id: "will",
            step: "lost",
            from: "broker",
            to: "dashboard",
            kind: "PUBLISH",
            name: "PUBLISH · QoS 0 · the will",
            time: "165.000",
            fields: [["30", "type", "publish-q0"], ["19", "size", "rl-25"], STATUS, ["6F 66 66 6C 69 6E 65", "value", "offline"]],
        },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "gateway",
        receiver: "dashboard",
        rows: [
            { id: "status", address: "plant/gw1/status", values: [["connect", "–", "–"], ["online", "online", "–"], ["subscribe", "online", "online"], ["lost", "–", "offline"]] },
            { id: "power", address: "plant/inv1/telemetry", values: [["connect", "4820.5 kW", "–"], ["publish", "4820.5 kW", "4820.5 kW"], ["lost", "–", "4820.5 kW"]] },
        ],
    },
    timing: {
        unit: "s",
        scale: "linear",
        end: 180,
        ticks: [0, 30, 60, 90, 120, 150, 180],
        tracks: [
            {
                id: "gateway",
                events: [
                    { t: 0, mark: "event", label: "connect" },
                    { t: 15, mark: "repeat" },
                    { t: 75, mark: "repeat", label: "ping" },
                    { t: 100, mark: "beat", label: "lost" },
                ],
            },
            { id: "broker", events: [{ t: 165, mark: "event", label: "will" }] },
        ],
    },
    anatomy: [
        {
            id: "topic",
            parts: [
                ["plant", "address", "a-site"],
                ["inv1", "address", "a-device"],
                ["telemetry", "type", "a-data"],
            ],
            also: "plant/inv1/telemetry",
        },
        {
            id: "filter",
            parts: [
                ["plant", "address", "a-site"],
                ["+", "cause", "a-plus"],
                ["telemetry", "type", "a-data"],
            ],
            also: "plant/+/telemetry → plant/inv1/telemetry, plant/inv2/telemetry",
        },
    ],
    playground: [{ kind: "file", sample: "mosquitto.conf", file: broker, notes: { 4: "anonymous", 5: "passwords", 6: "acl", 9: "plain", 12: "tls", 18: "persistence" } }],
    related: ["sparkplug-b", "modbus-tcp", "opc-ua"],
};
