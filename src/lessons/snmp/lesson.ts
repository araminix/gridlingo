import type { Field, Lesson } from "../types";
import portOutput from "./switch-port3.txt?raw";

/** The start of every SNMPv2c message: its length, version 1 (v2c) and the community. */
const head = (length: string, size: string): Field[] => [
    [length, "size", size],
    ["02 01 01", "frame", "version"],
    ["04 0A 73 74 34 74 69 6F 6E 2D 72 6F", "security", "community"],
];
/** request-id, error-status 0 and error-index 0. */
const ids = (id: string, key: string): Field[] => [
    [id, "control", key],
    ["02 01 00 02 01 00", "cause", "no-error"],
];
const UPTIME = "06 08 2B 06 01 02 01 01 03 00";
const OPER3 = "06 0A 2B 06 01 02 01 02 02 01 08 03";

export const lesson: Lesson = {
    actors: ["nms", "firewall", "switch", "relay"],
    scene: {
        devices: [
            { id: "nms", kind: "scada", at: [0, 3], address: "10.10.0.5", active: true },
            { id: "firewall", kind: "firewall", at: [4.5, 3] },
            { id: "switch", kind: "switch", at: [9, 3], address: "10.20.0.2", active: true },
            { id: "relay", kind: "relay", at: [9, 7.5], address: "10.20.0.21" },
        ],
        links: [
            { id: "wan", from: "nms", to: "firewall" },
            { id: "snmp", from: "firewall", to: "switch", label: "SNMP · UDP 161 / 162", active: true },
            { id: "port3", from: "switch", to: "relay", via: "y" },
        ],
    },
    steps: [{ id: "ask" }, { id: "answer" }, { id: "trap" }, { id: "secure" }],
    frames: [
        {
            id: "get",
            step: "ask",
            from: "nms",
            to: "switch",
            kind: "SNMPv2c",
            name: "GetRequest · sysUpTime.0, ifOperStatus.3",
            time: "0.000",
            fields: [
                ["30", "type", "message"],
                ...head("3B", "len-get"),
                ["A0 2A", "type", "pdu-get"],
                ...ids("02 02 2C 1B", "request-id"),
                ["30 1E", "size", "varbinds-get"],
                ["30 0C", "size", "vb"],
                [UPTIME, "address", "oid-uptime"],
                ["05 00", "value", "null"],
                ["30 0E", "size", "vb"],
                [OPER3, "address", "oid-oper"],
                ["05 00", "value", "null"],
            ],
        },
        {
            id: "response",
            step: "answer",
            from: "switch",
            to: "nms",
            kind: "SNMPv2c",
            name: "Response · up 36 days · port 3 up",
            time: "0.004",
            fields: [
                ["30", "type", "message"],
                ...head("40", "len-response"),
                ["A2 2F", "type", "pdu-response"],
                ...ids("02 02 2C 1B", "request-id-copy"),
                ["30 23", "size", "varbinds-response"],
                ["30 10", "size", "vb"],
                [UPTIME, "address", "oid-uptime"],
                ["43 04 12 8A 2D E0", "time", "uptime"],
                ["30 0F", "size", "vb"],
                [OPER3, "address", "oid-oper"],
                ["02 01 01", "value", "oper-up"],
            ],
        },
        {
            id: "trap",
            step: "trap",
            from: "switch",
            to: "nms",
            kind: "SNMPv2c",
            name: "SNMPv2-Trap · linkDown · port 3",
            time: "67.170",
            fields: [
                ["30", "type", "message"],
                ...head("7B", "len-trap"),
                ["A7 6A", "type", "pdu-trap"],
                ...ids("02 02 01 51", "trap-id"),
                ["30 5E", "size", "varbinds-trap"],
                ["30 10", "size", "vb"],
                [UPTIME, "address", "oid-uptime"],
                ["43 04 12 8A 48 1D", "time", "uptime-trap"],
                ["30 17", "size", "vb"],
                ["06 0A 2B 06 01 06 03 01 01 04 01 00", "address", "oid-trapoid"],
                ["06 09 2B 06 01 06 03 01 01 05 03", "cause", "linkdown"],
                ["30 0F", "size", "vb"],
                ["06 0A 2B 06 01 02 01 02 02 01 01 03", "address", "oid-index"],
                ["02 01 03", "value", "index"],
                ["30 0F", "size", "vb"],
                ["06 0A 2B 06 01 02 01 02 02 01 07 03", "address", "oid-admin"],
                ["02 01 01", "value", "admin-up"],
                ["30 0F", "size", "vb"],
                [OPER3, "address", "oid-oper"],
                ["02 01 02", "value", "oper-down"],
            ],
        },
        { id: "check", step: "trap", from: "nms", to: "switch", kind: "SNMPv2c", name: "GetRequest · ifOperStatus.3 → down(2)", time: "67.250" },
        { id: "v3-get", step: "secure", from: "nms", to: "switch", kind: "SNMPv3", name: "GetRequest · authPriv · user nmsread", time: "120.000" },
        { id: "v3-response", step: "secure", from: "switch", to: "nms", kind: "SNMPv3", name: "Response · authPriv", time: "120.004" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "switch",
        receiver: "nms",
        rows: [
            { id: "uptime", address: "sysUpTime.0", values: [["ask", "36 d 00:00:56", "–"], ["answer", "36 d 00:00:56", "36 d 00:00:56"], ["trap", "36 d 00:02:03", "36 d 00:02:03"]] },
            { id: "admin", address: "ifAdminStatus.3", values: [["ask", "~up", "–"], ["trap", "~up", "~up"]] },
            { id: "oper", address: "ifOperStatus.3", values: [["ask", "~up", "–"], ["answer", "~up", "~up"], ["trap", "~down", "~down"]] },
        ],
    },
    anatomy: [
        {
            id: "oid",
            parts: [
                ["2B", "address", "a-iso"],
                ["06 01", "address", "a-internet"],
                ["02 01", "address", "a-mib2"],
                ["02 02 01", "address", "a-iftable"],
                ["08", "value", "a-column"],
                ["03", "control", "a-index"],
            ],
            also: "1.3.6.1.2.1.2.2.1.8.3  =  iso.org.dod.internet.mgmt.mib-2.interfaces.ifTable.ifEntry.ifOperStatus.3",
        },
    ],
    playground: [{ kind: "file", sample: "switch-port3.txt", file: portOutput, notes: { 1: "command", 2: "descr", 3: "type", 4: "speed", 5: "admin", 6: "oper", 7: "last", 8: "errors" } }],
    related: ["iec-62351", "iec-62443", "prp-hsr", "ntp"],
};
