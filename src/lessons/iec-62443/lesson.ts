import type { Lesson } from "../types";
import rules from "./conduit-rules.txt?raw";

export const lesson: Lesson = {
    actors: ["laptop", "vendor", "fw1", "jump", "historian", "scada", "inverter"],
    scene: {
        devices: [
            { id: "laptop", kind: "laptop", at: [0, 0], address: "10.10.4.27" },
            { id: "vendor", kind: "laptop", at: [3, 3.5], address: "198.51.100.23" },
            { id: "fw1", kind: "firewall", at: [3, 0], active: true },
            { id: "historian", kind: "broker", at: [6, 0], address: "10.20.0.10" },
            { id: "jump", kind: "broker", at: [6, -3], address: "10.20.0.20" },
            { id: "fw2", kind: "firewall", at: [9, 0], active: true },
            { id: "scada", kind: "scada", at: [13, 0], address: "10.30.0.10" },
            { id: "fswitch", kind: "switch", at: [9, 3.5] },
            { id: "rtu", kind: "rtu", at: [9, 7], address: "10.40.0.20" },
            { id: "inverter", kind: "inverter", at: [12.5, 3.5], address: "10.40.1.7" },
        ],
        links: [
            { id: "office", from: "laptop", to: "fw1" },
            { id: "internet", from: "vendor", to: "fw1" },
            { id: "dmz-historian", from: "fw1", to: "historian", label: "C1" },
            { id: "dmz-jump", from: "fw1", to: "jump", via: "y" },
            { id: "historian-fw2", from: "historian", to: "fw2", label: "C2" },
            { id: "jump-fw2", from: "jump", to: "fw2", label: "C4" },
            { id: "control", from: "fw2", to: "scada" },
            { id: "field", from: "fw2", to: "fswitch", label: "C3" },
            { id: "rtu", from: "fswitch", to: "rtu" },
            { id: "inverter", from: "fswitch", to: "inverter" },
        ],
    },
    steps: [{ id: "inside" }, { id: "historian" }, { id: "office" }, { id: "blocked" }, { id: "vendor" }],
    frames: [
        { id: "scada-poll", step: "inside", from: "scada", to: "inverter", kind: "Allow", name: "Modbus · 502", time: "0.000" },
        { id: "historian-read", step: "historian", from: "historian", to: "scada", kind: "Allow", name: "OPC UA · 4840", time: "1.000" },
        { id: "scada-values", step: "historian", from: "scada", to: "historian", kind: "Reply", name: "OPC UA reply", time: "1.012" },
        { id: "office-read", step: "office", from: "laptop", to: "historian", kind: "Allow", name: "HTTPS · 443", time: "5.000" },
        { id: "blocked", step: "blocked", from: "laptop", to: "fw1", kind: "Deny", name: "TCP 502 → 10.40.1.7", time: "9.000" },
        { id: "vendor-login", step: "vendor", from: "vendor", to: "jump", kind: "Allow", name: "HTTPS · 443 · MFA", time: "60.000" },
        { id: "vendor-session", step: "vendor", from: "jump", to: "inverter", kind: "Allow", name: "HTTPS · 443", time: "75.000" },
    ],
    facts: ["standard", "between", "transport", "security", "model"],
    anatomy: [
        {
            id: "levels",
            parts: [
                ["SL 1", "quality", "sl1"],
                ["SL 2", "cause", "sl2"],
                ["SL 3", "type", "sl3"],
                ["SL 4", "security", "sl4"],
            ],
        },
        {
            id: "vector",
            parts: [
                ["IAC 3", "address", "fr1"],
                ["UC 3", "control", "fr2"],
                ["SI 3", "type", "fr3"],
                ["DC 2", "security", "fr4"],
                ["RDF 3", "frame", "fr5"],
                ["TRE 2", "time", "fr6"],
                ["RA 3", "value", "fr7"],
            ],
            also: "SL-T(control) = { 3 3 3 2 3 2 3 }",
        },
    ],
    playground: [
        {
            kind: "file",
            sample: "conduit-rules.txt",
            file: rules,
            notes: { 3: "zones", 4: "enterprise", 5: "dmz", 6: "control", 7: "field", 9: "conduits", 10: "office", 11: "vendor", 12: "deny", 13: "historian", 16: "scada-poll", 18: "job" },
        },
    ],
    related: ["iec-62351", "modbus-security", "dnp3-sa"],
};
