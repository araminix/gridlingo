import type { Lesson } from "../types";
import control from "./dercontrol.xml?raw";

export const lesson: Lesson = {
    actors: ["inverter", "server"],
    scene: {
        devices: [
            { id: "pv", kind: "pv", at: [2.5, -0.5] },
            { id: "inverter", kind: "inverter", at: [2.5, 3], address: "10.1.0.20", active: true },
            { id: "router", kind: "gateway", at: [6, 3] },
            { id: "server", kind: "cloud", at: [12, 3], address: "sep.utility.example", active: true },
        ],
        links: [
            { id: "dc", from: "pv", to: "inverter", via: "y" },
            { id: "lan", from: "inverter", to: "router", active: true },
            { id: "wan", from: "router", to: "server", label: "IEEE 2030.5 · HTTPS", active: true },
        ],
    },
    steps: [{ id: "tls" }, { id: "discover" }, { id: "control" }, { id: "received" }, { id: "start" }, { id: "report" }],
    frames: [
        {
            id: "client-hello",
            step: "tls",
            from: "inverter",
            to: "server",
            kind: "TLS",
            name: "ClientHello",
            time: "0.000",
            fields: [
                ["16", "type", "record-type"],
                ["03 03", "control", "record-version"],
                ["00 45", "size", "record-length"],
                ["01", "type", "client-hello"],
                ["00 00 41", "size", "hello-length"],
                ["03 03", "control", "client-version"],
                ["5B 08 B3 B6 A5 05 62 DA D6 CD 51 FA A2 25 F7 0E 35 E5 B3 FB 9C 91 14 25 B5 47 1C FD 03 5F 21 71", "security", "random"],
                ["00", "size", "session-id"],
                ["00 02", "size", "suites-length"],
                ["C0 AE", "security", "suite"],
                ["01 00", "control", "compression"],
                ["00 16", "size", "extensions-length"],
                ["00 0A 00 04 00 02 00 17", "security", "groups"],
                ["00 0B 00 02 01 00", "control", "point-formats"],
                ["00 0D 00 04 00 02 04 03", "security", "signatures"],
            ],
        },
        { id: "server-hello", step: "tls", from: "server", to: "inverter", kind: "TLS", name: "ServerHello … ServerHelloDone", time: "0.041" },
        { id: "client-finished", step: "tls", from: "inverter", to: "server", kind: "TLS", name: "Certificate … Finished", time: "0.118" },
        { id: "server-finished", step: "tls", from: "server", to: "inverter", kind: "TLS", name: "ChangeCipherSpec · Finished", time: "0.160" },
        { id: "get-dcap", step: "discover", from: "inverter", to: "server", kind: "HTTP", name: "GET /dcap", time: "0.190" },
        { id: "dcap", step: "discover", from: "server", to: "inverter", kind: "HTTP", name: "200 · DeviceCapability", time: "0.224" },
        { id: "get-edev", step: "discover", from: "inverter", to: "server", kind: "HTTP", name: "GET /edev", time: "0.260" },
        { id: "edev", step: "discover", from: "server", to: "inverter", kind: "HTTP", name: "200 · EndDeviceList", time: "0.301" },
        { id: "get-derc", step: "control", from: "inverter", to: "server", kind: "HTTP", name: "GET /derp/1/derc", time: "0.410" },
        { id: "derc", step: "control", from: "server", to: "inverter", kind: "HTTP", name: "200 · DERControlList", time: "0.452" },
        { id: "post-received", step: "received", from: "inverter", to: "server", kind: "HTTP", name: "POST /rsps/1/rsp · status 1", time: "0.520" },
        { id: "created", step: "received", from: "server", to: "inverter", kind: "HTTP", name: "201 Created", time: "0.561" },
        { id: "post-started", step: "start", from: "inverter", to: "server", kind: "HTTP", name: "POST /rsps/1/rsp · status 2", time: "5400.000" },
        { id: "post-reading", step: "report", from: "inverter", to: "server", kind: "HTTP", name: "POST /mup/1 · MirrorMeterReading", time: "5460.000" },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    points: {
        device: "inverter",
        receiver: "server",
        rows: [
            { id: "limit", address: "opModMaxLimW", values: [["tls", "–", "~planned"], ["control", "~planned", "~planned"], ["start", "50 %", "50 %"]] },
            { id: "status", address: "Response.status", values: [["tls", "–", "–"], ["received", "~received", "~received"], ["start", "~started", "~started"]] },
            { id: "power", address: "MirrorMeterReading", values: [["tls", "9.6 kW", "–"], ["start", "5.0 kW", "–"], ["report", "5.0 kW", "5.0 kW"]] },
        ],
    },
    anatomy: [
        {
            id: "lfdi",
            parts: [
                ["BB1309569", "address", "a-first36"],
                ["EF761C13E620EA80AA3E84D2B6B553D", "value", "a-rest"],
                ["BE609A5D02577A3CBD51493E", "frame", "a-dropped"],
            ],
            also: "LFDI = BB1309569EF761C13E620EA80AA3E84D2B6B553D",
        },
        {
            id: "sfdi",
            parts: [
                ["50217391465", "address", "s-number"],
                ["7", "control", "s-check"],
            ],
            also: "0xBB1309569 = 50217391465  ·  SFDI = 502173914657",
        },
    ],
    playground: [{ kind: "file", sample: "dercontrol.xml", file: control, notes: { 2: "href", 3: "reply", 4: "mrid", 6: "created", 8: "status", 13: "duration", 14: "start", 17: "limit" } }],
    related: ["sunspec", "openadr", "iec-61850-7-420"],
};
