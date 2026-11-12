import type { Field, Lesson } from "../types";
import substation from "./substation.scd?raw";

const SUBSCRIBERS = ["f2prot", "gateway", "hmi"] as const;

/** A GOOSE frame of F1 PROT's trip data set: the parts that never change, and the ones given. */
function goose(time: string, stNum: string, sqNum: string, trip: "00" | "01"): Field[] {
    return [
        ["01 0C CD 01 00 01", "address", "dst"],
        ["02 00 00 00 00 F1", "address", "src"],
        ["81 00 80 0A", "control", "vlan"],
        ["88 B8", "type", "ethertype"],
        ["00 01", "address", "appid"],
        ["00 73", "size", "length"],
        ["00 00 00 00", "frame", "reserved"],
        ["61 69", "frame", "pdu"],
        ["80 19 46 31 50 52 4F 54 4C 44 30 2F 4C 4C 4E 30 24 47 4F 24 67 63 62 54 72 69 70", "address", "gocbref"],
        ["81 02 07 D0", "time", "tal"],
        ["82 15 46 31 50 52 4F 54 4C 44 30 2F 4C 4C 4E 30 24 64 73 54 72 69 70", "address", "datset"],
        ["83 0B 46 31 50 52 4F 54 5F 54 72 69 70", "address", "goid"],
        [`84 08 ${time}`, "time", time.startsWith("6A F5 72") ? "t-old" : "t-event"],
        [`85 01 ${stNum}`, "control", `stnum-${parseInt(stNum, 16)}`],
        [`86 01 ${sqNum}`, "control", `sqnum-${parseInt(sqNum, 16)}`],
        ["87 01 00", "quality", "simulation"],
        ["88 01 01", "control", "confrev"],
        ["89 01 00", "quality", "ndscom"],
        ["8A 01 02", "size", "entries"],
        [`AB 08 83 01 ${trip} 84 03 03 00 00`, "value", trip === "01" ? "data-trip" : "data-idle"],
    ];
}

export const lesson: Lesson = {
    actors: ["q1", "f1prot", "f2prot", "gateway", "hmi", "scada"],
    scene: {
        devices: [
            { id: "q1", kind: "breaker", at: [0, 0] },
            { id: "f1prot", kind: "relay", at: [2, 0], address: "10.0.1.11", active: true },
            { id: "f2prot", kind: "relay", at: [5, -1], address: "10.0.1.12" },
            { id: "switch", kind: "switch", at: [4, 3] },
            { id: "hmi", kind: "scada", at: [1.5, 5.5] },
            { id: "gateway", kind: "gateway", at: [6, 5] },
            { id: "scada", kind: "scada", at: [9.5, 6.5] },
        ],
        links: [
            { id: "trip", from: "f1prot", to: "q1" },
            { id: "bus1", from: "f1prot", to: "switch", active: true },
            { id: "bus2", from: "f2prot", to: "switch", via: "y" },
            { id: "bus3", from: "hmi", to: "switch" },
            { id: "bus4", from: "gateway", to: "switch", via: "y" },
            { id: "wan", from: "gateway", to: "scada", label: "IEC 104" },
        ],
    },
    steps: [{ id: "heartbeat" }, { id: "fault" }, { id: "publish" }, { id: "repeat" }, { id: "act" }, { id: "open" }],
    frames: [
        { id: "heartbeat", step: "heartbeat", from: "f1prot", to: SUBSCRIBERS, kind: "GOOSE", name: "stNum 12 · sqNum 3", time: "0.000", fields: goose("6A F5 72 00 00 00 00 0A", "0C", "03", "00") },
        { id: "trip-wire", step: "fault", from: "f1prot", to: "q1", kind: "Wire", name: "Trip contact closes", time: "0.232" },
        { id: "event", step: "publish", from: "f1prot", to: SUBSCRIBERS, kind: "GOOSE", name: "stNum 13 · sqNum 0", time: "0.232", fields: goose("6A F5 97 C3 3B 64 5C 0A", "0D", "00", "01") },
        { id: "repeat", step: "repeat", from: "f1prot", to: SUBSCRIBERS, kind: "GOOSE", name: "stNum 13 · sqNum 1", time: "0.234", fields: goose("6A F5 97 C3 3B 64 5C 0A", "0D", "01", "01") },
        { id: "to-scada", step: "act", from: "gateway", to: "scada", kind: "IEC 104", name: "M_DP_TB_1 · spont", time: "0.236" },
        { id: "opened", step: "open", from: "q1", to: "f1prot", kind: "Wire", name: "Auxiliary contact: open", time: "0.280" },
    ],
    facts: ["standard", "between", "transport", "frames", "speed"],
    points: {
        device: "f1prot",
        receiver: "f2prot",
        rows: [
            { id: "tr", address: "PTRC1.Tr.general", values: [["heartbeat", "FALSE", "FALSE"], ["fault", "TRUE", "FALSE"], ["publish", "TRUE", "TRUE"]] },
            { id: "stnum", address: "stNum", values: [["heartbeat", "12", "12"], ["publish", "13", "13"]] },
            { id: "sqnum", address: "sqNum", values: [["heartbeat", "3", "3"], ["publish", "0", "0"], ["repeat", "1", "1"]] },
        ],
    },
    singleLine: {
        feeders: [
            { id: "f1", load: "pv" },
            { id: "f2", load: "battery" },
            { id: "f3", load: "supply" },
        ],
        ieds: [
            { id: "f1prot", feeder: "f1", bus: "station" },
            { id: "f2prot", feeder: "f2", bus: "station" },
        ],
        extras: ["hmi", "gateway"],
        states: [
            { step: "heartbeat", flow: { from: "f1prot", to: SUBSCRIBERS, label: "GOOSE · stNum 12 · Tr FALSE" } },
            { step: "fault", fault: "f1" },
            { step: "publish", fault: "f1", flow: { from: "f1prot", to: SUBSCRIBERS, label: "GOOSE · stNum 13 · Tr TRUE" } },
            { step: "repeat", fault: "f1", flow: { from: "f1prot", to: SUBSCRIBERS, label: "GOOSE · stNum 13 · sqNum 1" } },
            { step: "act", fault: "f1" },
            { step: "open", open: ["f1"] },
        ],
    },
    timing: {
        unit: "ms",
        scale: "log",
        end: 2000,
        ticks: [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1000, 2000],
        tracks: [
            {
                id: "publisher",
                events: [
                    { t: 0, mark: "event", label: "event" },
                    { t: 2, mark: "repeat", label: "repeats" },
                    { t: 4, mark: "repeat" },
                    { t: 8, mark: "repeat" },
                    { t: 16, mark: "repeat" },
                    { t: 32, mark: "repeat" },
                    { t: 64, mark: "repeat" },
                    { t: 128, mark: "repeat" },
                    { t: 256, mark: "repeat" },
                    { t: 512, mark: "repeat" },
                    { t: 1000, mark: "beat", label: "heartbeat" },
                    { t: 2000, mark: "beat" },
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "gocbref",
            parts: [
                ["F1PROT", "address", "a-ied"],
                ["LD0", "address", "a-ld"],
                ["LLN0", "type", "a-ln"],
                ["GO", "cause", "a-fc"],
                ["gcbTrip", "value", "a-cb"],
            ],
            also: "F1PROTLD0/LLN0$GO$gcbTrip",
        },
    ],
    playground: [{ kind: "scl", sample: "substation.scd", file: substation }],
    related: ["iec-61850-mms", "iec-61850-sv", "r-goose", "prp-hsr"],
};
