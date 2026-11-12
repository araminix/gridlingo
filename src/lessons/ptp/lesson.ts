import type { Field, Lesson } from "../types";

/** The Ethernet header: destination, source and the PTP EtherType. */
const ethernet = (dst: "all" | "peer", src: "gm" | "sw" | "mu"): Field[] => [
    dst === "all" ? ["01 1B 19 00 00 00", "address", "dst-all"] : ["01 80 C2 00 00 0E", "address", "dst-peer"],
    [{ gm: "02 00 00 00 01 01", sw: "02 00 00 00 02 03", mu: "02 00 00 00 03 01" }[src], "address", `src-${src}`],
    ["88 F7", "type", "ethertype"],
];

/** The 34-byte header every PTP message starts with. */
function header(type: [string, string], length: [string, string], flags: [string, string], correction: [string, string], port: [string, string], sequence: [string, string], control: [string, string], interval: [string, string]): Field[] {
    return [
        [type[0], "type", type[1]],
        ["02", "frame", "version"],
        [length[0], "size", length[1]],
        ["00", "address", "domain"],
        ["00", "frame", "reserved1"],
        [flags[0], "control", flags[1]],
        [correction[0], "time", correction[1]],
        ["00 00 00 00", "frame", "reserved4"],
        [port[0], "address", port[1]],
        [sequence[0], "control", sequence[1]],
        [control[0], "frame", control[1]],
        [interval[0], "time", interval[1]],
    ];
}

const GM_PORT: [string, string] = ["02 00 00 FF FE 00 01 01 00 01", "port-gm"];
const SW_PORT: [string, string] = ["02 00 00 FF FE 00 02 00 00 03", "port-sw"];
const MU_PORT: [string, string] = ["02 00 00 FF FE 00 03 01 00 01", "port-mu"];
const NO_CORRECTION: [string, string] = ["00 00 00 00 00 00 00 00", "corr-0"];
const ZERO_TIME = "00 00 00 00 00 00 00 00 00 00";

/** A Pdelay message between the MU and port 3 of the switch: never forwarded, so it stays on that one cable. */
const pdelay = (src: "sw" | "mu", type: [string, string], flags: [string, string], port: [string, string], body: Field[]): Field[] => [
    ...ethernet("peer", src),
    ...header(type, ["00 36", "len54"], flags, NO_CORRECTION, port, ["01 51", "seq-pdelay"], ["05", "control-other"], ["7F", "interval-none"]),
    ...body,
];

/** The grandmaster's Follow_Up to Sync 0x2C1B, with the correction field it has at this point. */
const followUp = (correction: [string, string]): Field[] => [
    ...ethernet("all", "gm"),
    ...header(["08", "type-fup"], ["00 2C", "len44"], ["00 00", "flags-0"], correction, GM_PORT, ["2C 1B", "seq-fup"], ["02", "control-fup"], ["00", "interval-1s"]),
    ["00 00 6A F5 97 E8 00 00 00 78", "time", "t-origin"],
    ["00 00", "frame", "padding"],
];

export const lesson: Lesson = {
    actors: ["gm", "switch", "mu", "relay"],
    scene: {
        devices: [
            { id: "antenna", kind: "radio", at: [0, -0.5] },
            { id: "gm", kind: "clock", at: [0, 3], address: "02-00-00-00-01-01", active: true },
            { id: "switch", kind: "switch", at: [4.5, 3], active: true },
            { id: "mu", kind: "merging-unit", at: [9, 3], address: "02-00-00-00-03-01", active: true },
            { id: "relay", kind: "relay", at: [4.5, 7] },
        ],
        links: [
            { id: "gps", from: "antenna", to: "gm", via: "y" },
            { id: "ptp", from: "gm", to: "switch", label: "PTP · 0x88F7", active: true },
            { id: "mu", from: "switch", to: "mu", active: true },
            { id: "relay", from: "switch", to: "relay", via: "y" },
        ],
    },
    steps: [{ id: "announce" }, { id: "pdelay" }, { id: "sync" }, { id: "correct" }, { id: "lock" }, { id: "sv" }],
    frames: [
        {
            id: "announce",
            step: "announce",
            from: "gm",
            to: "mu",
            kind: "PTP",
            name: "Announce · clockClass 6",
            time: "0.000000",
            fields: [
                ...ethernet("all", "gm"),
                ...header(["0B", "type-announce"], ["00 40", "len64"], ["00 3C", "flags-announce"], NO_CORRECTION, GM_PORT, ["02 A7", "seq-announce"], ["05", "control-other"], ["00", "interval-1s"]),
                [ZERO_TIME, "time", "origin-announce"],
                ["00 25", "time", "utc-offset"],
                ["00", "frame", "reserved1"],
                ["80", "value", "priority1"],
                ["06", "quality", "class6"],
                ["21", "quality", "accuracy"],
                ["4E 5D", "quality", "variance"],
                ["80", "value", "priority2"],
                ["02 00 00 FF FE 00 01 01", "address", "gm-id"],
                ["00 00", "size", "steps-removed"],
                ["20", "type", "source-gps"],
            ],
        },
        {
            id: "pdelay-req",
            step: "pdelay",
            from: "mu",
            to: "switch",
            kind: "PTP",
            name: "Pdelay_Req · seq 337",
            time: "0.484119",
            fields: pdelay("mu", ["02", "type-preq"], ["00 00", "flags-0"], MU_PORT, [
                [ZERO_TIME, "time", "origin-preq"],
                [ZERO_TIME, "frame", "reserved10"],
            ]),
        },
        {
            id: "pdelay-resp",
            step: "pdelay",
            from: "switch",
            to: "mu",
            kind: "PTP",
            name: "Pdelay_Resp · t2",
            time: "0.484169",
            fields: pdelay("sw", ["03", "type-presp"], ["02 00", "flags-two-step"], SW_PORT, [
                ["00 00 6A F5 97 E7 2B C1 CA 3A", "time", "t2"],
                ["02 00 00 FF FE 00 03 01 00 01", "address", "requesting"],
            ]),
        },
        {
            id: "pdelay-fup",
            step: "pdelay",
            from: "switch",
            to: "mu",
            kind: "PTP",
            name: "Pdelay_Resp_Follow_Up · t3",
            time: "0.484412",
            fields: pdelay("sw", ["0A", "type-pfup"], ["00 00", "flags-0"], SW_PORT, [
                ["00 00 6A F5 97 E7 2B C2 86 92", "time", "t3"],
                ["02 00 00 FF FE 00 03 01 00 01", "address", "requesting"],
            ]),
        },
        {
            id: "sync",
            step: "sync",
            from: "gm",
            to: "mu",
            kind: "PTP",
            name: "Sync · seq 11291 · two-step",
            time: "0.750000",
            fields: [
                ...ethernet("all", "gm"),
                ...header(["00", "type-sync"], ["00 2C", "len44"], ["02 00", "flags-two-step"], NO_CORRECTION, GM_PORT, ["2C 1B", "seq-sync"], ["00", "control-sync"], ["00", "interval-1s"]),
                [ZERO_TIME, "time", "origin-sync"],
                ["00 00", "frame", "padding"],
            ],
        },
        { id: "fup-gm", step: "sync", from: "gm", to: "switch", kind: "PTP", name: "Follow_Up · correction 0", time: "0.750210", fields: followUp(NO_CORRECTION) },
        { id: "fup-tc", step: "correct", from: "switch", to: "mu", kind: "PTP", name: "Follow_Up · +7848 ns", time: "0.750218", fields: followUp(["00 00 00 00 1E A8 00 00", "corr-tc"]) },
        { id: "lock", step: "lock", from: "gm", to: "mu", kind: "PTP", name: "Sync · Follow_Up · seq 11299", time: "8.750000" },
        { id: "sv", step: "sv", from: "mu", to: "relay", kind: "SV", name: "SV · smpSynch 2", time: "9.000000" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "gm",
        receiver: "mu",
        rows: [
            { id: "class", address: "Announce", values: [["announce", "6", "6"]] },
            { id: "utc", address: "Announce", values: [["announce", "37 s", "37 s"]] },
            { id: "delay", address: "Pdelay", values: [["announce", "412 ns", "–"], ["pdelay", "412 ns", "1486 ns"]] },
            { id: "offset", address: "Sync", values: [["announce", "~reference", "–"], ["correct", "~reference", "+2.461318 ms"], ["lock", "~reference", "+38 ns"]] },
        ],
    },
    timing: {
        unit: "µs",
        scale: "linear",
        end: 12,
        ticks: [0, 2, 4, 6, 8, 10, 12],
        tracks: [
            { id: "gm", events: [{ t: 0, mark: "event", label: "leave" }] },
            {
                id: "switch",
                events: [
                    { t: 0.412, mark: "repeat", label: "in" },
                    { t: 7.848, mark: "repeat", label: "out" },
                ],
            },
            { id: "mu", events: [{ t: 9.334, mark: "event", label: "arrive" }] },
        ],
    },
    anatomy: [
        {
            id: "port",
            parts: [
                ["02 00 00", "address", "a-oui"],
                ["FF FE", "frame", "a-fffe"],
                ["00 01 01", "address", "a-nic"],
                ["00 01", "control", "a-port"],
            ],
            also: "MAC 02-00-00-00-01-01  →  clockIdentity 02 00 00 FF FE 00 01 01 · port 1",
        },
    ],
    related: ["iec-61850-sv", "irig-b", "prp-hsr", "iec-61850-goose"],
};
