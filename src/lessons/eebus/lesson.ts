import type { Lesson } from "../types";
import limit from "./lpc-limit.json?raw";

// SHIP frames start with one byte for the kind of message; the rest is JSON in UTF-8. The SPINE messages are long JSON,
// so they are told in words and the limit itself is the playground.
export const lesson: Lesson = {
    actors: ["dso", "box", "wallbox", "car"],
    scene: {
        devices: [
            { id: "dso", kind: "cloud", at: [0, 0] },
            { id: "box", kind: "controller", at: [4.5, 0], address: "10.0.0.20", active: true },
            { id: "wallbox", kind: "charger", at: [9, 0], address: "10.0.0.42", active: true },
            { id: "car", kind: "car", at: [9, 4.5] },
        ],
        links: [
            { id: "cls", from: "dso", to: "box" },
            { id: "ship", from: "box", to: "wallbox", label: "EEBus · SHIP · TLS", active: true },
            { id: "cable", from: "wallbox", to: "car", via: "y" },
        ],
    },
    steps: [{ id: "discover" }, { id: "pair" }, { id: "handshake" }, { id: "discovery" }, { id: "limit" }, { id: "failsafe" }],
    frames: [
        { id: "mdns", step: "discover", from: "wallbox", to: "box", kind: "mDNS", name: "_ship._tcp · ski=4C8E…", time: "0.000" },
        { id: "tls", step: "pair", from: "box", to: "wallbox", kind: "TLS", name: "TLS 1.2 · both certificates · SKI checked", time: "12.000" },
        {
            id: "init",
            step: "handshake",
            from: "box",
            to: "wallbox",
            kind: "SHIP",
            name: "Connection mode init",
            time: "12.300",
            fields: [
                ["00", "type", "type-init"],
                ["00", "value", "cmi"],
            ],
        },
        {
            id: "hello",
            step: "handshake",
            from: "box",
            to: "wallbox",
            kind: "SHIP",
            name: "connectionHello · ready",
            time: "12.320",
            fields: [
                ["01", "type", "type-control"],
                ["7B 22 63 6F 6E 6E 65 63 74 69 6F 6E 48 65 6C 6C 6F 22 3A", "type", "hello-name"],
                ["5B 7B 22 70 68 61 73 65 22 3A 22 72 65 61 64 79 22 7D", "value", "phase"],
                ["2C 7B 22 77 61 69 74 69 6E 67 22 3A 36 30 30 30 30 7D", "time", "waiting"],
                ["5D 7D", "frame", "close"],
            ],
        },
        { id: "protocol", step: "handshake", from: "box", to: "wallbox", kind: "SHIP", name: "Protocol handshake · access methods", time: "12.400" },
        { id: "detailed", step: "discovery", from: "box", to: "wallbox", kind: "SPINE", name: "read · nodeManagementDetailedDiscoveryData", time: "12.600" },
        { id: "features", step: "discovery", from: "wallbox", to: "box", kind: "SPINE", name: "reply · LoadControl, DeviceConfiguration, DeviceDiagnosis", time: "12.700" },
        { id: "write", step: "limit", from: "box", to: "wallbox", kind: "SPINE", name: "write · loadControlLimitListData · 4200 W · PT2H", time: "3600.000" },
        { id: "result", step: "limit", from: "wallbox", to: "box", kind: "SPINE", name: "result · errorNumber 0", time: "3600.080" },
        { id: "pwm", step: "limit", from: "wallbox", to: "car", kind: "IEC 61851", name: "PWM 10 % · 6 A per phase", time: "3600.500" },
        { id: "heartbeat", step: "failsafe", from: "box", to: "wallbox", kind: "SPINE", name: "notify · heartbeat (the last one)", time: "4200.000" },
        { id: "fallback", step: "failsafe", from: "wallbox", to: "car", kind: "IEC 61851", name: "PWM stays 10 % · failsafe limit", time: "4320.000" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "box",
        receiver: "wallbox",
        rows: [
            { id: "trust", address: "SKI", values: [["discover", "–", "–"], ["pair", "~trusted", "~trusted"]] },
            { id: "limit", address: "LoadControl", values: [["discover", "–", "–"], ["limit", "4.2 kW · 2 h", "4.2 kW · 2 h"], ["failsafe", "–", "~failsafe"]] },
            { id: "power", address: "EV", values: [["discover", "–", "11 kW"], ["limit", "–", "4.1 kW"]] },
        ],
    },
    anatomy: [
        {
            id: "device",
            parts: [
                ["d:", "type", "a-device"],
                ["_i:32473", "address", "a-pen"],
                ["_Wallbox-0042", "address", "a-name"],
            ],
            also: "d:_i:32473_Wallbox-0042  ·  entity [1]  ·  feature 7 (LoadControl, server)",
        },
    ],
    playground: [{ kind: "file", sample: "lpc-limit.json", file: limit, notes: { 4: "version", 5: "source", 6: "destination", 7: "counter", 8: "write", 9: "ack", 13: "function", 15: "id", 16: "active", 17: "duration", 18: "value" } }],
    related: ["iec-61851", "ocpp", "iso-15118", "openadr"],
};
