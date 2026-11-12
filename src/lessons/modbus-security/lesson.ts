import type { Field, Lesson } from "../types";
import certificate from "./monitoring-cert.txt?raw";

/** The 5-byte header of a TLS 1.2 record of application data. What follows it is encrypted and not shown. */
const appData = (length: string, key: string): Field[] => [
    ["17", "type", "rec-app"],
    ["03 03", "frame", "rec-v12"],
    [length, "size", key],
];

export const lesson: Lesson = {
    actors: ["monitoring", "inverter"],
    scene: {
        devices: [
            { id: "monitoring", kind: "scada", at: [0, 4], address: "10.0.0.8 · Viewer", active: true },
            { id: "inverter", kind: "inverter", at: [6, 1.5], address: "10.0.0.31 · TCP 802", active: true },
            { id: "pv", kind: "pv", at: [9, -0.6] },
            { id: "controller", kind: "controller", at: [9.2, 4.2], address: "10.0.0.5 · Operator" },
        ],
        links: [
            { id: "mbaps", from: "monitoring", to: "inverter", label: "Modbus over TLS · TCP 802", active: true },
            { id: "dc", from: "inverter", to: "pv", via: "y" },
            { id: "control", from: "inverter", to: "controller" },
        ],
    },
    steps: [{ id: "connect" }, { id: "hello" }, { id: "prove" }, { id: "read" }, { id: "write" }],
    frames: [
        { id: "tcp", step: "connect", from: "monitoring", to: "inverter", kind: "TCP", name: "SYN · SYN-ACK · ACK", time: "0.000" },
        {
            id: "client-hello",
            step: "hello",
            from: "monitoring",
            to: "inverter",
            kind: "TLS",
            name: "ClientHello",
            time: "0.002",
            fields: [
                ["16", "type", "rec-handshake"],
                ["03 01", "frame", "rec-v10"],
                ["00 82", "size", "rec-len-130"],
                ["01", "type", "hs-hello"],
                ["00 00 7E", "size", "hs-len-126"],
                ["03 03", "control", "hello-version"],
                ["8D 70 8A FE 89 C2 7F 26", "security", "random"],
                ["00 58 48 36 8B C2 F3 B9", "security", "random-more"],
                ["11 78 F3 CF 96 89 09 0F", "security", "random-more"],
                ["83 9E 3B FE 8A 93 52 E3", "security", "random-more"],
                ["00", "size", "session-id"],
                ["00 02 C0 2F", "security", "suites"],
                ["01 00", "frame", "compression"],
                ["00 53", "size", "ext-len"],
                ["FF 01 00 01 00", "control", "ext-reneg"],
                ["00 0B 00 04 03 00 01 02", "control", "ext-points"],
                ["00 0A 00 0C 00 0A", "control", "ext-groups"],
                ["00 1D 00 17 00 1E 00 18 00 19", "security", "groups"],
                ["00 16 00 00 00 17 00 00", "control", "ext-flags"],
                ["00 0D 00 2A 00 28", "control", "ext-sigalgs"],
                ["04 03 05 03 06 03 08 07", "security", "sigalgs"],
                ["08 08 08 09 08 0A 08 0B", "security", "sigalgs-more"],
                ["08 04 08 05 08 06 04 01", "security", "sigalgs-more"],
                ["05 01 06 01 03 03 03 01", "security", "sigalgs-more"],
                ["03 02 04 02 05 02 06 02", "security", "sigalgs-more"],
            ],
        },
        { id: "server-hello", step: "hello", from: "inverter", to: "monitoring", kind: "TLS", name: "ServerHello … ServerHelloDone", time: "0.006" },
        { id: "client-cert", step: "prove", from: "monitoring", to: "inverter", kind: "TLS", name: "Certificate … Finished", time: "0.031" },
        { id: "server-finished", step: "prove", from: "inverter", to: "monitoring", kind: "TLS", name: "ChangeCipherSpec · Finished", time: "0.044" },
        { id: "read-req", step: "read", from: "monitoring", to: "inverter", kind: "TLS", name: "Application data · FC 03", time: "0.050", fields: appData("00 24", "len-read-req") },
        { id: "read-resp", step: "read", from: "inverter", to: "monitoring", kind: "TLS", name: "Application data · FC 03", time: "0.058", fields: appData("00 25", "len-read-resp") },
        { id: "write-req", step: "write", from: "monitoring", to: "inverter", kind: "TLS", name: "Application data · FC 06", time: "2.000", fields: appData("00 24", "len-write-req") },
        { id: "write-refused", step: "write", from: "inverter", to: "monitoring", kind: "TLS", name: "Application data · FC 86", time: "2.006", fields: appData("00 21", "len-refused") },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "inverter",
        receiver: "monitoring",
        rows: [
            {
                id: "role",
                address: "X.509",
                values: [
                    ["connect", "–", "Viewer"],
                    ["prove", "Viewer", "Viewer"],
                ],
            },
            {
                id: "p",
                address: "40101",
                values: [
                    ["connect", "4820.5 kW", "–"],
                    ["read", "4820.5 kW", "4820.5 kW"],
                ],
            },
            {
                id: "limit",
                address: "40201",
                values: [
                    ["connect", "5000 kW", "–"],
                    ["write", "5000 kW", "~refused"],
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "role",
            parts: [
                ["30 17", "frame", "a-extension"],
                ["06 0B 2B 06 01 04 01 83 89 0C 86 22 01", "type", "a-oid"],
                ["04 08", "size", "a-octets"],
                ["0C 06", "type", "a-utf8"],
                ["56 69 65 77 65 72", "value", "a-role"],
            ],
            also: "1.3.6.1.4.1.50316.802.1 = UTF8String \"Viewer\"",
        },
    ],
    playground: [{ kind: "file", sample: "monitoring-cert.txt", file: certificate, notes: { 6: "issuer", 9: "expiry", 10: "subject", 17: "client-auth", 18: "role-oid", 19: "role-value" } }],
    related: ["modbus-tcp", "iec-62351", "iec-62443"],
};
