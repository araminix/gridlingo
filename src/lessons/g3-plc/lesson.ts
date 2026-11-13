import type { Field, Lesson } from "../types";
import topology from "./dc-topology.csv?raw";

// What the adaptation layer hands to the G3 MAC: a mesh header, IPv6 and UDP squeezed by 6LoWPAN, then DLMS/COSEM. The
// MAC adds its own header, the network key's encryption and a CRC; those are told in words. PAN 0x4C21: the concentrator
// is 0x0000, M1 is 0x0001, M2 is 0x0002, and each IPv6 address is fe80::4c21:ff:fe00:<short address>.

/** The mesh header, the compressed IPv6 header and the compressed UDP header, from one short address to another. */
const lowpan = (from: "dc" | "m2", checksum: string, key: string): Field[] => [
    ["B8", "control", "mesh"],
    [from === "dc" ? "00 00 00 02" : "00 02 00 00", "address", from === "dc" ? "mesh-dc-m2" : "mesh-m2-dc"],
    ["7E 33", "type", "iphc"],
    ["F0", "type", "nhc-udp"],
    ["0F DB 0F DB", "address", "ports"],
    [checksum, "frame", key],
];

/** The DLMS/COSEM wrapper: version 1, the source and destination wPort, the length of the APDU. */
const wrapper = (from: "dc" | "m2", length: string, key: string): Field[] => [
    ["00 01", "frame", "version"],
    [from === "dc" ? "00 11 00 01" : "00 01 00 11", "address", from === "dc" ? "wports-dc" : "wports-m2"],
    [length, "size", key],
];

export const lesson: Lesson = {
    actors: ["hes", "dc", "m1", "m2"],
    scene: {
        devices: [
            { id: "hes", kind: "scada", at: [0, 0], address: "10.30.0.8" },
            { id: "dc", kind: "gateway", at: [4, 0], address: "0x0000", active: true },
            { id: "transformer", kind: "transformer", at: [4, 4] },
            { id: "m1", kind: "meter", at: [8.5, 0], address: "0x0001", active: true },
            { id: "m2", kind: "meter", at: [12, 0], address: "0x0002", active: true },
        ],
        links: [
            { id: "cell", from: "hes", to: "dc", radio: true },
            { id: "lv", from: "transformer", to: "dc", via: "y" },
            { id: "plc", from: "dc", to: "m1", label: "G3-PLC · CENELEC A", active: true },
            { id: "street", from: "m1", to: "m2", active: true },
        ],
    },
    steps: [{ id: "join" }, { id: "route" }, { id: "read" }, { id: "answer" }, { id: "upload" }],
    frames: [
        { id: "discover", step: "join", from: "m2", to: "m1", kind: "MAC", name: "Beacon request", time: "0.000" },
        { id: "join", step: "join", from: "m2", to: "dc", kind: "LBP", name: "LBP JOINING · EAP-PSK", time: "0.900" },
        { id: "accepted", step: "join", from: "dc", to: "m2", kind: "LBP", name: "LBP ACCEPTED · short address 0x0002", time: "6.400" },
        { id: "rreq", step: "route", from: "dc", to: "m2", kind: "LOADng", name: "RREQ · to 0x0002", time: "60.000" },
        { id: "rrep", step: "route", from: "m2", to: "dc", kind: "LOADng", name: "RREP · via 0x0001", time: "60.700" },
        {
            id: "get",
            step: "read",
            from: "dc",
            to: "m2",
            kind: "6LoWPAN · DLMS",
            name: "GET 1-0:1.8.0 · 0x0000 → 0x0002",
            time: "61.000",
            fields: [
                ...lowpan("dc", "C1 90", "checksum-get"),
                ...wrapper("dc", "00 0D", "len-13"),
                ["C0 01", "type", "get-req"],
                ["C1", "control", "invoke"],
                ["00 03", "type", "class-3"],
                ["01 00 01 08 00 FF", "address", "obis"],
                ["02", "value", "attr-2"],
                ["00", "control", "no-selection"],
            ],
        },
        {
            id: "response",
            step: "answer",
            from: "m2",
            to: "dc",
            kind: "6LoWPAN · DLMS",
            name: "GET response · 303603",
            time: "61.420",
            fields: [
                ...lowpan("m2", "C9 FF", "checksum-response"),
                ...wrapper("m2", "00 09", "len-9"),
                ["C4 01", "type", "get-resp"],
                ["C1", "control", "invoke"],
                ["00", "cause", "data"],
                ["06", "type", "uint32"],
                ["00 04 A1 F3", "value", "raw"],
            ],
        },
        { id: "upload", step: "upload", from: "dc", to: "hes", kind: "DLMS · TCP", name: "Daily readings · 312 meters", time: "3600.000" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "m2",
        receiver: "dc",
        rows: [
            { id: "short", address: "MAC", values: [["join", "0x0002", "0x0002"]] },
            { id: "route", address: "LOADng", values: [["join", "–", "–"], ["route", "~via", "~via"]] },
            { id: "energy", address: "1-0:1.8.0", values: [["join", "3036.03 kWh", "–"], ["answer", "3036.03 kWh", "3036.03 kWh"]] },
        ],
    },
    anatomy: [
        {
            id: "address",
            parts: [
                ["FE 80 00 00 00 00 00 00", "frame", "a-prefix"],
                ["4C 21", "address", "a-pan"],
                ["00 FF FE 00", "frame", "a-fill"],
                ["00 02", "address", "a-short"],
            ],
            also: "fe80::4c21:ff:fe00:2  =  link-local · PAN 0x4C21 · short address 0x0002",
        },
    ],
    playground: [{ kind: "file", sample: "dc-topology.csv", file: topology, notes: { 2: "columns", 3: "direct", 4: "relayed", 5: "phase", 6: "far" } }],
    related: ["dlms-cosem", "m-bus", "iso-15118", "lorawan"],
};
