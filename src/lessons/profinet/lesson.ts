import type { Field, Lesson } from "../types";

// MAC addresses are locally administered (02-…), as in the other Ethernet lessons. DCP and cyclic frames are shown from
// the destination address to the last byte before the check sum; RPC calls and alarms are explained in words.
const MAC = { laptop: "02 00 00 00 00 E0", plc: "02 00 00 00 00 01", io: "02 00 00 00 00 10" } as const;
const NAME = "74 72 61 66 6F 2D 69 6F"; // trafo-io
const zeros = (count: number) => Array.from({ length: count }, () => "00").join(" ");

/** A DCP frame: the header, its blocks, and zeros up to the 60 bytes an Ethernet frame needs. */
function dcp(to: string, from: string, head: Field[], blocks: Field[]): Field[] {
    const fields: Field[] = [[to, "address", to === MAC.io ? "dst-io" : "dst-dcp"], [from, "address", from === MAC.plc ? "src-plc" : "src-laptop"], ["88 92", "type", "ethertype"], ...head, ...blocks];
    const size = fields.reduce((sum, [hex]) => sum + hex.split(" ").length, 0);
    return [...fields, [zeros(60 - size), "frame", "pad"]];
}

/** A cyclic frame on a tag of priority 6: 40 bytes of data, then the cycle counter, the data status and the transfer status. */
function cyclic(to: string, from: string, id: Field, data: Field[], cycle: string): Field[] {
    const size = data.reduce((sum, [hex]) => sum + hex.split(" ").length, 0);
    return [
        [to, "address", to === MAC.io ? "dst-io" : "dst-plc"],
        [from, "address", from === MAC.plc ? "src-plc" : "src-io"],
        ["81 00 C0 00", "control", "vlan"],
        ["88 92", "type", "ethertype"],
        id,
        ...data,
        [zeros(40 - size), "frame", "fill"],
        [cycle, "time", "cycle"],
        ["35", "quality", "status-run"],
        ["00", "control", "transfer"],
    ];
}

const OUT: Field = ["C0 00", "type", "fid-out"];
const IN: Field = ["C0 01", "type", "fid-in"];
const outputs = (fans: Field) => cyclic(MAC.io, MAC.plc, OUT, [["80 80 80 80", "quality", "iocs-head"], ["80", "quality", "iocs-ai"], fans, ["80", "quality", "iops-dq"]], fans[0] === "00" ? "3E 80" : "B1 C0");
const inputs = (temperature: Field) => cyclic(MAC.plc, MAC.io, IN, [["80 80 80 80", "quality", "iops-head"], temperature, ["80", "quality", "iops-ai"], ["80", "quality", "iocs-dq"]], temperature[2] === "temp-725" ? "6A 40" : "DC 80");

export const lesson: Lesson = {
    actors: ["laptop", "plc", "io"],
    scene: {
        devices: [
            { id: "plc", kind: "controller", at: [0, 0], address: "192.168.0.1", active: true },
            { id: "io", kind: "rtu", at: [4.5, 0], address: "192.168.0.10", active: true },
            { id: "t1", kind: "transformer", at: [4.5, 4] },
            { id: "laptop", kind: "laptop", at: [0, 4] },
        ],
        links: [
            { id: "profinet", from: "plc", to: "io", label: "PROFINET · 2 ms", active: true },
            { id: "wires", from: "io", to: "t1", via: "y" },
            { id: "port2", from: "laptop", to: "plc", via: "y" },
        ],
    },
    steps: [{ id: "name" }, { id: "find" }, { id: "connect" }, { id: "cyclic" }, { id: "hot" }, { id: "alarm" }],
    frames: [
        {
            id: "identify-all",
            step: "name",
            from: "laptop",
            to: "io",
            kind: "DCP",
            name: "Identify All · 01-0E-CF-00-00-00",
            time: "0.000",
            fields: dcp("01 0E CF 00 00 00", MAC.laptop, [["FE FE", "type", "fid-identify"], ["05 00", "control", "identify-req"], ["00 00 00 01", "control", "xid"], ["00 01", "time", "delay"], ["00 04", "size", "dcp-len"]], [["FF FF 00 00", "address", "all"]]),
        },
        { id: "identify-new", step: "name", from: "io", to: "laptop", kind: "DCP", name: "Identify response · no name · IP 0.0.0.0", time: "0.002" },
        {
            id: "set-name",
            step: "name",
            from: "laptop",
            to: "io",
            kind: "DCP",
            name: "Set NameOfStation · trafo-io · permanent",
            time: "21.000",
            fields: dcp(MAC.io, MAC.laptop, [["FE FD", "type", "fid-set"], ["04 00", "control", "set-req"], ["00 00 00 02", "control", "xid"], ["00 00", "frame", "reserved"], ["00 0E", "size", "dcp-len"]], [["02 02 00 0A", "address", "name-set"], ["00 01", "control", "permanent"], [NAME, "value", "name"]]),
        },
        { id: "set-name-ok", step: "name", from: "io", to: "laptop", kind: "DCP", name: "Set response · OK", time: "21.003" },
        {
            id: "identify-name",
            step: "find",
            from: "plc",
            to: "io",
            kind: "DCP",
            name: "Identify · NameOfStation trafo-io",
            time: "300.000",
            fields: dcp("01 0E CF 00 00 00", MAC.plc, [["FE FE", "type", "fid-identify"], ["05 00", "control", "identify-req"], ["00 00 10 01", "control", "xid"], ["00 01", "time", "delay"], ["00 0C", "size", "dcp-len"]], [["02 02 00 08", "address", "name-match"], [NAME, "value", "name"]]),
        },
        { id: "found", step: "find", from: "io", to: "plc", kind: "DCP", name: "Identify response · trafo-io · 02-00-00-00-00-10", time: "300.002" },
        {
            id: "set-ip",
            step: "find",
            from: "plc",
            to: "io",
            kind: "DCP",
            name: "Set IP · 192.168.0.10 / 255.255.255.0",
            time: "300.010",
            fields: dcp(MAC.io, MAC.plc, [["FE FD", "type", "fid-set"], ["04 00", "control", "set-req"], ["00 00 10 02", "control", "xid"], ["00 00", "frame", "reserved"], ["00 12", "size", "dcp-len"]], [["01 02 00 0E", "address", "ip-block"], ["00 00", "control", "temporary"], ["C0 A8 00 0A", "address", "ip"], ["FF FF FF 00", "address", "mask"], ["00 00 00 00", "address", "gateway"]]),
        },
        { id: "set-ip-ok", step: "find", from: "io", to: "plc", kind: "DCP", name: "Set response · OK", time: "300.013" },
        { id: "connect-req", step: "connect", from: "plc", to: "io", kind: "RPC", name: "Connect.req · AR · IOCR in, out 2 ms · alarm CR · expected modules", time: "300.250" },
        { id: "connect-res", step: "connect", from: "io", to: "plc", kind: "RPC", name: "Connect.res · OK · no module difference", time: "300.262" },
        { id: "prm-end", step: "connect", from: "plc", to: "io", kind: "RPC", name: "Write · slot 1 parameters · Control PrmEnd", time: "300.300" },
        { id: "app-ready", step: "connect", from: "io", to: "plc", kind: "RPC", name: "Control · ApplicationReady", time: "300.420" },
        { id: "out", step: "cyclic", from: "plc", to: "io", kind: "RT", name: "Outputs · 0xC000 · fans off", time: "300.500", fields: outputs(["00", "value", "fans-off"]) },
        { id: "in", step: "cyclic", from: "io", to: "plc", kind: "RT", name: "Inputs · 0xC001 · 72.5 °C", time: "300.501", fields: inputs(["02 D5", "value", "temp-725"]) },
        { id: "in-hot", step: "hot", from: "io", to: "plc", kind: "RT", name: "Inputs · 0xC001 · 85.0 °C", time: "5400.001", fields: inputs(["03 52", "value", "temp-850"]) },
        { id: "out-fans", step: "hot", from: "plc", to: "io", kind: "RT", name: "Outputs · 0xC000 · fans 1 and 2 on", time: "5400.004", fields: outputs(["03", "value", "fans-on"]) },
        { id: "alarm", step: "alarm", from: "io", to: "plc", kind: "Alarm", name: "Alarm · Diagnosis appears · slot 1 · channel 0 · wire break", time: "9000.000" },
        { id: "alarm-ack", step: "alarm", from: "plc", to: "io", kind: "Alarm", name: "Alarm ack", time: "9000.003" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "io",
        receiver: "plc",
        rows: [
            { id: "name", address: "NameOfStation", values: [["name", "trafo-io", "–"], ["find", "trafo-io", "trafo-io"]] },
            { id: "ip", address: "IP", values: [["name", "0.0.0.0", "–"], ["find", "192.168.0.10", "192.168.0.10"]] },
            { id: "temp", address: "Slot 1 · channel 0", values: [["name", "–", "–"], ["cyclic", "72.5 °C", "72.5 °C"], ["hot", "85.0 °C", "85.0 °C"], ["alarm", "~break", "~break"]] },
            { id: "fans", address: "Slot 2 · bits 0, 1", values: [["name", "~off", "–"], ["cyclic", "~off", "~off"], ["hot", "~on", "~on"]] },
        ],
    },
    timing: {
        unit: "ms",
        scale: "linear",
        end: 18,
        ticks: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18],
        tracks: [
            { id: "out", events: [...[0, 2, 4, 6].map((t) => ({ t, mark: "beat" as const })), { t: 12, mark: "event", label: "safe" }] },
            { id: "in", events: [...[1, 3, 5].map((t) => ({ t, mark: "beat" as const })), { t: 11, mark: "event", label: "down" }] },
            { id: "cable", events: [{ t: 6.5, mark: "event", label: "cut" }] },
        ],
    },
    anatomy: [
        {
            id: "status",
            parts: [
                ["0", "control", "ds-ignore"],
                ["0", "frame", "ds-reserved"],
                ["1", "quality", "ds-problem"],
                ["1", "control", "ds-run"],
                ["0", "frame", "ds-reserved"],
                ["1", "quality", "ds-valid"],
                ["0", "control", "ds-redundancy"],
                ["1", "control", "ds-primary"],
            ],
            also: "0x35  =  0011 0101  ·  bit 7 … bit 0",
        },
    ],
    playground: [{ kind: "encoder", type: "int16", order: "ABCD", value: 725 }],
    related: ["iec-61850-goose", "modbus-tcp", "snmp", "iec-62443"],
};
