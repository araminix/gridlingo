import type { Lesson } from "../types";
import publisher from "./relay-a-publisher.txt?raw";

const KDC_LINK = "GDOI · UDP 848";

export const lesson: Lesson = {
    actors: ["breakera", "relaya", "kdc", "relayb", "breakerb"],
    scene: {
        devices: [
            { id: "breakera", kind: "breaker", at: [-0.8, 0] },
            { id: "relaya", kind: "relay", at: [2, 0], address: "10.1.0.11", active: true },
            { id: "routera", kind: "gateway", at: [2, 3.4], address: "10.1.0.1" },
            { id: "wan", kind: "switch", at: [7, 3.4] },
            { id: "kdc", kind: "broker", at: [7, -0.6], address: "10.0.0.50" },
            { id: "routerb", kind: "gateway", at: [12, 3.4], address: "10.2.0.1" },
            { id: "relayb", kind: "relay", at: [12, 0], address: "10.2.0.12", active: true },
            { id: "breakerb", kind: "breaker", at: [14.8, 0] },
        ],
        links: [
            { id: "trip-a", from: "breakera", to: "relaya" },
            { id: "lan-a", from: "relaya", to: "routera", via: "y" },
            { id: "wan-a", from: "routera", to: "wan", label: "R-GOOSE · UDP 102", active: true },
            { id: "wan-b", from: "wan", to: "routerb", active: true },
            { id: "lan-b", from: "routerb", to: "relayb", via: "y" },
            { id: "trip-b", from: "relayb", to: "breakerb" },
            { id: "keys", from: "kdc", to: "wan", via: "y", label: KDC_LINK },
        ],
    },
    steps: [{ id: "keys" }, { id: "heartbeat" }, { id: "fault" }, { id: "repeat" }, { id: "act" }],
    frames: [
        { id: "pull-a", step: "keys", from: "relaya", to: "kdc", kind: "GDOI", name: "GROUPKEY-PULL", time: "0.000" },
        { id: "pull-b", step: "keys", from: "relayb", to: "kdc", kind: "GDOI", name: "GROUPKEY-PULL", time: "0.020" },
        { id: "keys-a", step: "keys", from: "kdc", to: "relaya", kind: "GDOI", name: "GROUPKEY-PULL · keys", time: "0.180" },
        { id: "keys-b", step: "keys", from: "kdc", to: "relayb", kind: "GDOI", name: "GROUPKEY-PULL · keys", time: "0.210" },
        {
            id: "heartbeat",
            step: "heartbeat",
            from: "relaya",
            to: "relayb",
            kind: "R-GOOSE",
            name: "stNum 4 · SPDU 20871",
            time: "10.000",
            // Ethernet, IPv4 and UDP as relay A sends them; the R-GOOSE session layer after them is told in words
            fields: [
                ["01 00 5E 40 00 01", "address", "e-dst"],
                ["02 00 00 00 0A 11", "address", "e-src"],
                ["08 00", "type", "e-type"],
                ["45", "frame", "ip-ver"],
                ["B8", "control", "dscp"],
                ["00 C4", "size", "ip-len"],
                ["2F 3A 00 00", "frame", "ip-id"],
                ["10", "control", "ttl"],
                ["11", "type", "proto"],
                ["80 6A", "frame", "ip-sum"],
                ["0A 01 00 0B", "address", "ip-src"],
                ["EF C0 00 01", "address", "ip-dst"],
                ["C0 01", "address", "udp-src"],
                ["00 66", "address", "udp-dst"],
                ["00 B0", "size", "udp-len"],
            ],
        },
        { id: "trip-a", step: "fault", from: "relaya", to: "breakera", kind: "Wire", name: "Trip contact closes", time: "10.518" },
        { id: "intertrip", step: "fault", from: "relaya", to: "relayb", kind: "R-GOOSE", name: "stNum 5 · sqNum 0 · SPDU 20872", time: "10.518" },
        { id: "repeat", step: "repeat", from: "relaya", to: "relayb", kind: "R-GOOSE", name: "stNum 5 · sqNum 1 · SPDU 20873", time: "10.520" },
        { id: "trip-b", step: "act", from: "relayb", to: "breakerb", kind: "Wire", name: "Trip contact closes", time: "10.529" },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "relaya",
        receiver: "relayb",
        rows: [
            { id: "tr", address: "PTRC1.Tr.general", values: [["keys", "FALSE", "–"], ["heartbeat", "FALSE", "FALSE"], ["fault", "TRUE", "TRUE"]] },
            { id: "stnum", address: "stNum", values: [["keys", "4", "–"], ["heartbeat", "4", "4"], ["fault", "5", "5"]] },
            { id: "spdu", address: "SPDU number", values: [["keys", "–", "–"], ["heartbeat", "20871", "20871"], ["fault", "20872", "20872"], ["repeat", "20873", "20873"]] },
            { id: "key", address: "Key ID", values: [["keys", "7", "7"]] },
        ],
    },
    anatomy: [
        {
            id: "multicast",
            parts: [
                ["01-00-5E", "type", "a-prefix"],
                ["40-00-01", "address", "a-low"],
            ],
            also: "239.192.0.1 → 01-00-5E-40-00-01",
        },
    ],
    playground: [
        { kind: "file", sample: "relay-a-publisher.txt", file: publisher, notes: { 2: "cb", 3: "group", 4: "port", 5: "mac", 6: "ttl", 7: "dscp", 8: "kdc", 9: "security", 10: "repeat" } },
    ],
    related: ["iec-61850-goose", "iec-62351", "iec-61850-sv", "c37-118"],
};
