import type { Field, Lesson } from "../types";
import capture from "./controller-capture.txt?raw";

/** F1 PROT's GOOSE message, byte for byte as in the GOOSE lesson: the heartbeat (stNum 12) or the trip (stNum 13). */
function goose(message: "idle" | "trip"): Field[] {
    const trip = message === "trip";
    return [
        ["01 0C CD 01 00 01", "address", "dst"],
        ["02 00 00 00 00 F1", "address", "src"],
        ["81 00 80 0A", "control", "vlan"],
        ["88 B8", "type", "ethertype"],
        ["00 01 00 73 00 00 00 00", "frame", "goose-header"],
        ["61 69", "frame", "goose-pdu"],
        ["80 19 46 31 50 52 4F 54 4C 44 30 2F 4C 4C 4E 30 24 47 4F 24 67 63 62 54 72 69 70", "address", "gocbref"],
        ["81 02 07 D0", "time", "tal"],
        ["82 15 46 31 50 52 4F 54 4C 44 30 2F 4C 4C 4E 30 24 64 73 54 72 69 70", "address", "datset"],
        ["83 0B 46 31 50 52 4F 54 5F 54 72 69 70", "address", "goid"],
        trip ? ["84 08 6A F5 97 C3 3B 64 5C 0A", "time", "t-event"] : ["84 08 6A F5 72 00 00 00 00 0A", "time", "t-old"],
        trip ? ["85 01 0D 86 01 00", "control", "st-13"] : ["85 01 0C 86 01 03", "control", "st-12"],
        ["87 01 00 88 01 01", "control", "flags-1"],
        ["89 01 00 8A 01 02", "size", "flags-2"],
        [`AB 08 83 01 ${trip ? "01" : "00"} 84 03 03 00 00`, "value", `data-${message}`],
    ];
}

/** One copy of a GOOSE frame as PRP sends it: the frame unchanged, then the redundancy control trailer. */
function copy(message: "idle" | "trip", seq: string, lan: "A" | "B"): Field[] {
    return [
        ...goose(message),
        [seq, "control", `seq-${parseInt(seq.replace(" ", ""), 16)}`],
        [`${lan}0 79`, "address", `lan-${lan.toLowerCase()}`],
        ["88 FB", "type", "suffix"],
    ];
}

export const lesson: Lesson = {
    actors: ["relay", "controller"],
    scene: {
        devices: [
            { id: "relay", kind: "relay", at: [0, 0], address: "02-00-00-00-00-F1", active: true },
            { id: "swa", kind: "switch", at: [4.4, 0] },
            { id: "swb", kind: "switch", at: [0, 4.4] },
            { id: "controller", kind: "controller", at: [4.4, 4.4], address: "02-00-00-00-00-C1", active: true },
        ],
        // LAN A and LAN B each run from the relay through their switch to the controller; "a-up" is LAN A's first cable alone
        links: [
            { id: "a-up", from: "relay", to: "swa" },
            { id: "lan-a", from: "relay", to: "controller", label: "LAN A" },
            { id: "lan-b", from: "relay", to: "controller", via: "y", label: "LAN B" },
        ],
    },
    steps: [{ id: "two" }, { id: "send" }, { id: "drop" }, { id: "break" }, { id: "alarm" }],
    frames: [
        { id: "sup-a", step: "two", from: "relay", to: "controller", kind: "PRP", name: "Supervision · LAN A", time: "0.000000", link: "lan-a" },
        { id: "sup-b", step: "two", from: "relay", to: "controller", kind: "PRP", name: "Supervision · LAN B", time: "0.000000", link: "lan-b" },
        { id: "copy-a", step: "send", from: "relay", to: "controller", kind: "GOOSE", name: "SeqNr 3900 · LAN A", time: "0.500012", link: "lan-a", fields: copy("idle", "0F 3C", "A") },
        { id: "copy-b", step: "drop", from: "relay", to: "controller", kind: "GOOSE", name: "SeqNr 3900 · LAN B", time: "0.500016", link: "lan-b", fields: copy("idle", "0F 3C", "B") },
        { id: "trip-a", step: "break", from: "relay", to: "controller", kind: "GOOSE", name: "SeqNr 3905 · LAN A · lost", time: "0.732006", link: "a-up" },
        { id: "trip-b", step: "break", from: "relay", to: "controller", kind: "GOOSE", name: "SeqNr 3905 · LAN B", time: "0.732016", link: "lan-b", fields: copy("trip", "0F 41", "B") },
        { id: "sup-only", step: "alarm", from: "relay", to: "controller", kind: "PRP", name: "Supervision · LAN B only", time: "2.000000", link: "lan-b" },
    ],
    facts: ["standard", "between", "transport", "frames", "speed"],
    points: {
        device: "relay",
        receiver: "controller",
        rows: [
            { id: "tr", address: "PTRC1.Tr.general", values: [["two", "FALSE", "–"], ["send", "FALSE", "FALSE"], ["break", "TRUE", "TRUE"]] },
            { id: "seq", address: "SeqNr", values: [["two", "–", "–"], ["send", "3900", "3900"], ["break", "3905", "3905"]] },
            { id: "porta", address: "port A", values: [["two", "~up", "~up"], ["break", "~up", "~down"]] },
            { id: "portb", address: "port B", values: [["two", "~up", "~up"]] },
        ],
    },
    anatomy: [
        {
            id: "rct",
            parts: [
                ["0F 3C", "control", "a-seq"],
                ["A", "address", "a-lan"],
                ["079", "size", "a-size"],
                ["88 FB", "type", "a-suffix"],
            ],
            also: "0F 3C · A0 79 · 88 FB",
        },
    ],
    playground: [
        { kind: "file", sample: "controller-capture.txt", file: capture, notes: { 2: "columns", 3: "first", 4: "drop", 5: "trip", 6: "lost", 7: "supervision", 9: "trailer" } },
    ],
    related: ["iec-61850-goose", "iec-61850-sv", "ptp", "iec-62443"],
};
