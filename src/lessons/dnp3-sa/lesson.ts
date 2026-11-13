import type { Field, Lesson } from "../types";
import settings from "./sa-settings.json?raw";

/**
 * Only the application layer is shown: the link and transport layers around it are those of the DNP3 lesson.
 * The challenge data and the MACs are made up; they have the length a real device sends.
 */

/** A control relay output block for output 0 (CB-1): one pulse of 1000 ms. The status is 0 in a request and in a success. */
const crob = (code: "81" | "41", status: Field): Field[] => [
    ["0C 01", "type", "g12v1"],
    ["17", "size", "q17"],
    ["01", "size", "count-1"],
    ["00", "address", "index-0"],
    [code, "value", code === "81" ? "trip" : "close"],
    ["01", "size", "pulses"],
    ["E8 03 00 00", "time", "on-time"],
    ["00 00 00 00", "time", "off-time"],
    status,
];

/**
 * 16 bytes shown as two fields of 8: the key's note for the first half, `<end>`'s for the second. One field of 16 bytes
 * is too wide for the byte list on a phone.
 */
const halves = (hex: string, key: string, end: string): Field[] => [
    [hex.slice(0, 23), "security", key],
    [hex.slice(24), "security", end],
];

/** An authentication challenge (g120v1) for user 1: HMAC-SHA-256 cut to 16 bytes, for a critical request. */
const challenge = (control: Field, csq: Field, data: string, key: string): Field[] => [
    control,
    ["83", "type", "fc-auth-response"],
    ["00 00", "quality", "iin"],
    ["78 01", "type", "g120v1"],
    ["5B 01 18 00", "size", "size-24"],
    csq,
    ["01 00", "address", "user-1"],
    ["04", "security", "mal-4"],
    ["01", "cause", "rfc-1"],
    ...halves(data, key, "data-end"),
];

/** An authentication reply (g120v2) of user 1. */
const reply = (control: Field, csq: Field, mac: string, key: string): Field[] => [
    control,
    ["20", "type", "fc-auth-request"],
    ["78 02", "type", "g120v2"],
    ["5B 01 16 00", "size", "size-22"],
    csq,
    ["01 00", "address", "user-1"],
    ...halves(mac, key, "mac-end"),
];

const REQUEST: Field = ["00", "quality", "status-request"];

export const lesson: Lesson = {
    actors: ["scada", "attacker", "rtu", "breaker"],
    scene: {
        devices: [
            { id: "scada", kind: "scada", at: [-0.5, 4.5], address: "master 1", active: true },
            { id: "switch", kind: "switch", at: [4, 2.5] },
            { id: "attacker", kind: "laptop", at: [4, -1], address: "10.0.0.66" },
            { id: "rtu", kind: "rtu", at: [7.5, 2.5], address: "outstation 10", active: true },
            { id: "breaker", kind: "breaker", at: [10, 0.5], address: "output 0" },
        ],
        links: [
            { id: "wan", from: "scada", to: "switch", label: "DNP3 SAv5 · TCP 20000", active: true },
            { id: "lan", from: "switch", to: "rtu", active: true },
            { id: "rogue", from: "attacker", to: "switch", via: "y" },
            { id: "trip", from: "rtu", to: "breaker" },
        ],
    },
    steps: [{ id: "keys" }, { id: "operate" }, { id: "challenge" }, { id: "reply" }, { id: "execute" }, { id: "replay" }],
    frames: [
        { id: "key-status-request", step: "keys", from: "scada", to: "rtu", kind: "SA", name: "AUTH_REQUEST · g120v4", time: "0.000" },
        { id: "key-status", step: "keys", from: "rtu", to: "scada", kind: "SA", name: "AUTH_RESPONSE · g120v5 · NOT_INIT", time: "0.021" },
        { id: "key-change", step: "keys", from: "scada", to: "rtu", kind: "SA", name: "AUTH_REQUEST · g120v6", time: "0.035" },
        { id: "key-ok", step: "keys", from: "rtu", to: "scada", kind: "SA", name: "AUTH_RESPONSE · g120v5 · OK", time: "0.058" },
        {
            id: "operate",
            step: "operate",
            from: "scada",
            to: "rtu",
            kind: "DNP3",
            name: "DIRECT_OPERATE · g12v1 TRIP",
            time: "30.000",
            fields: [["C3", "control", "ac-3"], ["05", "type", "fc-direct-operate"], ...crob("81", REQUEST)],
        },
        {
            id: "challenge",
            step: "challenge",
            from: "rtu",
            to: "scada",
            kind: "SA",
            name: "AUTH_RESPONSE · g120v1 · CSQ 5",
            time: "30.018",
            fields: challenge(["C3", "control", "ac-3-challenge"], ["05 00 00 00", "control", "csq-5"], "23 E2 FF 94 E3 E2 91 98 BF A8 34 B4 21 91 84 B0", "data-5"),
        },
        {
            id: "reply",
            step: "reply",
            from: "scada",
            to: "rtu",
            kind: "SA",
            name: "AUTH_REQUEST · g120v2 · CSQ 5",
            time: "30.031",
            fields: reply(["C3", "control", "ac-3-reply"], ["05 00 00 00", "control", "csq-5-reply"], "5E 1C 9C 85 A3 4E 27 24 98 0C 70 DE FB 74 33 84", "mac-5"),
        },
        { id: "pulse", step: "execute", from: "rtu", to: "breaker", kind: "Wire", name: "Trip output · 1000 ms", time: "30.044" },
        {
            id: "response",
            step: "execute",
            from: "rtu",
            to: "scada",
            kind: "DNP3",
            name: "RESPONSE · g12v1 · SUCCESS",
            time: "30.046",
            fields: [["C3", "control", "ac-3-response"], ["81", "type", "fc-response"], ["00 00", "quality", "iin"], ...crob("81", ["00", "quality", "status-success"])],
        },
        {
            id: "replay-operate",
            step: "replay",
            from: "attacker",
            to: "rtu",
            kind: "DNP3",
            name: "DIRECT_OPERATE · g12v1 CLOSE",
            time: "95.200",
            fields: [["CA", "control", "ac-10"], ["05", "type", "fc-direct-operate"], ...crob("41", REQUEST)],
        },
        {
            id: "challenge-6",
            step: "replay",
            from: "rtu",
            to: "attacker",
            kind: "SA",
            name: "AUTH_RESPONSE · g120v1 · CSQ 6",
            time: "95.218",
            fields: challenge(["CA", "control", "ac-10-challenge"], ["06 00 00 00", "control", "csq-6"], "0A 52 1A 9B FB 0A 77 26 4D 2F DE AD 1E D8 FA 8A", "data-6"),
        },
        {
            id: "replay-reply",
            step: "replay",
            from: "attacker",
            to: "rtu",
            kind: "SA",
            name: "AUTH_REQUEST · g120v2 · CSQ 2",
            time: "95.231",
            fields: reply(["CA", "control", "ac-10-reply"], ["02 00 00 00", "control", "csq-2"], "70 FE F1 78 16 3E 27 A0 2A 67 B7 3F CD B0 3E 62", "mac-2"),
        },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "rtu",
        receiver: "scada",
        rows: [
            { id: "cb", address: "BO 0", values: [["keys", "~closed", "~closed"], ["execute", "~open", "~open"]] },
            { id: "csq", address: "CSQ", values: [["keys", "4", "4"], ["challenge", "5", "5"], ["replay", "6", "5"]] },
        ],
    },
    playground: [{ kind: "file", sample: "sa-settings.json", file: settings, notes: { 4: "version", 7: "user", 8: "update-key", 11: "key-wrap", 12: "mac", 13: "interval", 14: "timeout", 15: "aggressive", 16: "critical" } }],
    related: ["dnp3", "iec-62351", "iec-62443"],
};
