import type { Field, Lesson } from "../types";

// The bytes shown are the ZCL frames as a sniffer that holds the keys shows them. On the air each one travels inside an
// IEEE 802.15.4 frame with network and APS headers, encrypted with AES-128 (CCM*). ZCL numbers are little-endian.
const REQUEST: Field = ["00", "control", "fc-request"];
const RESPONSE: Field = ["18", "control", "fc-response"];
const READ: Field = ["00", "type", "cmd-read"];
const READ_RESPONSE: Field = ["01", "type", "cmd-read-response"];
const demand = (tsn: string, value: string, key: string): Field[] => [RESPONSE, [tsn, "control", "tsn"], READ_RESPONSE, ["00 04", "address", "attr-demand"], ["00", "cause", "status-ok"], ["2A", "type", "type-int24"], [value, "value", key]];

export const lesson: Lesson = {
    actors: ["cloud", "meter", "charger"],
    scene: {
        devices: [
            { id: "meter", kind: "meter", at: [0, 0], address: "0x0000", active: true },
            { id: "charger", kind: "charger", at: [5, 0], address: "0x3B91", active: true },
            { id: "car", kind: "car", at: [9, 0] },
            { id: "cloud", kind: "cloud", at: [0, 4.5] },
        ],
        links: [
            { id: "han", from: "meter", to: "charger", label: "Zigbee SE · 2.4 GHz", radio: true, active: true },
            { id: "cable", from: "charger", to: "car" },
            { id: "ami", from: "cloud", to: "meter", label: "AMI", via: "y" },
        ],
    },
    steps: [{ id: "join" }, { id: "keys" }, { id: "units" }, { id: "read" }, { id: "event" }],
    frames: [
        { id: "associate", step: "join", from: "charger", to: "meter", kind: "802.15.4", name: "Beacon request · Association request", time: "0.000" },
        { id: "transport-key", step: "join", from: "meter", to: "charger", kind: "APS", name: "Transport Key · network key, under the install code key", time: "0.140" },
        { id: "announce", step: "join", from: "charger", to: "meter", kind: "ZDO", name: "Device announce · 0x3B91", time: "0.300" },
        { id: "ke-initiate", step: "keys", from: "charger", to: "meter", kind: "ZCL", name: "Key Establishment 0x0800 · Initiate · certificate", time: "1.500" },
        { id: "ke-confirm", step: "keys", from: "meter", to: "charger", kind: "ZCL", name: "Key Establishment · ephemeral data · Confirm Key", time: "2.400" },
        {
            id: "units",
            step: "units",
            from: "charger",
            to: "meter",
            kind: "ZCL",
            name: "Metering 0x0702 · Read Attributes 0x0300, 0x0301, 0x0302",
            time: "5.000",
            fields: [REQUEST, ["51", "control", "tsn"], READ, ["00 03", "address", "attr-unit"], ["01 03", "address", "attr-multiplier"], ["02 03", "address", "attr-divisor"]],
        },
        {
            id: "units-res",
            step: "units",
            from: "meter",
            to: "charger",
            kind: "ZCL",
            name: "Read Attributes Response · kW · × 1 ÷ 1000",
            time: "5.030",
            fields: [
                RESPONSE,
                ["51", "control", "tsn"],
                READ_RESPONSE,
                ["00 03", "address", "attr-unit"],
                ["00", "cause", "status-ok"],
                ["30", "type", "type-enum8"],
                ["00", "value", "unit-kw"],
                ["01 03", "address", "attr-multiplier"],
                ["00", "cause", "status-ok"],
                ["22", "type", "type-uint24"],
                ["01 00 00", "value", "multiplier-1"],
                ["02 03", "address", "attr-divisor"],
                ["00", "cause", "status-ok"],
                ["22", "type", "type-uint24"],
                ["E8 03 00", "value", "divisor-1000"],
            ],
        },
        {
            id: "read",
            step: "read",
            from: "charger",
            to: "meter",
            kind: "ZCL",
            name: "Metering · Read Attributes 0x0000, 0x0400",
            time: "5.200",
            fields: [REQUEST, ["52", "control", "tsn"], READ, ["00 00", "address", "attr-summation"], ["00 04", "address", "attr-demand"]],
        },
        {
            id: "read-res",
            step: "read",
            from: "meter",
            to: "charger",
            kind: "ZCL",
            name: "Read Attributes Response · 4821.337 kWh · 9.348 kW",
            time: "5.230",
            fields: [
                RESPONSE,
                ["52", "control", "tsn"],
                READ_RESPONSE,
                ["00 00", "address", "attr-summation"],
                ["00", "cause", "status-ok"],
                ["25", "type", "type-uint48"],
                ["59 91 49 00 00 00", "value", "summation"],
                ...demand("52", "84 24 00", "demand-9348").slice(3),
            ],
        },
        { id: "dr", step: "event", from: "cloud", to: "meter", kind: "AMI", name: "Demand response · EV chargers · −50 % · 2 h", time: "600.000" },
        { id: "lce", step: "event", from: "meter", to: "charger", kind: "ZCL", name: "DRLC 0x0701 · LoadControlEvent · average load −50 % · 2 h", time: "600.400" },
        { id: "status", step: "event", from: "charger", to: "meter", kind: "ZCL", name: "DRLC · ReportEventStatus · event started", time: "600.900" },
        { id: "read2", step: "event", from: "charger", to: "meter", kind: "ZCL", name: "Metering · Read Attributes 0x0400", time: "610.000", fields: [REQUEST, ["53", "control", "tsn"], READ, ["00 04", "address", "attr-demand"]] },
        { id: "read2-res", step: "event", from: "meter", to: "charger", kind: "ZCL", name: "Read Attributes Response · 5.748 kW", time: "610.030", fields: demand("53", "74 16 00", "demand-5748") },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "meter",
        receiver: "charger",
        rows: [
            { id: "key", address: "APS link key", values: [["join", "–", "–"], ["keys", "~agreed", "~agreed"]] },
            { id: "demand", address: "0x0400", values: [["join", "2.148 kW", "–"], ["read", "9.348 kW", "9.348 kW"], ["event", "5.748 kW", "5.748 kW"]] },
            { id: "charging", address: "EVSE", values: [["join", "–", "–"], ["read", "–", "7.2 kW"], ["event", "–", "3.6 kW"]] },
        ],
    },
    anatomy: [
        {
            id: "frame-control",
            parts: [
                ["000", "frame", "fc-reserved"],
                ["1", "control", "fc-no-default"],
                ["1", "control", "fc-direction"],
                ["0", "control", "fc-manufacturer"],
                ["00", "type", "fc-type"],
            ],
            also: "0x18 = 000 1 1 0 00  ·  0x00 = a request from client to server",
        },
    ],
    playground: [{ kind: "encoder", type: "int32", order: "DCBA", value: 9348 }],
    related: ["dlms-cosem", "ieee-2030-5", "matter", "openadr"],
};
