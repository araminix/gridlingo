import type { Field, Lesson } from "../types";
import codec from "./decoder.js.txt?raw";

/** The sensor's address, low byte first, as in every data frame after the join. */
const DEVADDR: Field = ["B4 A3 C2 01", "address", "devaddr"];

export const lesson: Lesson = {
    actors: ["sensor", "gw1", "gw2", "ns", "as"],
    scene: {
        devices: [
            { id: "transformer", kind: "transformer", at: [-1.5, 2.5] },
            { id: "sensor", kind: "sensor", at: [0, 0.5], address: "01C2A3B4", active: true },
            { id: "gw1", kind: "radio", at: [1, -3], active: true },
            { id: "gw2", kind: "radio", at: [5.5, 1.5], active: true },
            { id: "ns", kind: "cloud", at: [5, -3.5], active: true },
            { id: "as", kind: "cloud", at: [8.5, -3.5], active: true },
        ],
        links: [
            { id: "air1", from: "sensor", to: "gw1", radio: true, via: "y" },
            { id: "air2", from: "sensor", to: "gw2", label: "LoRa · 868.1 MHz · SF7", radio: true, via: "y" },
            { id: "ip1", from: "gw1", to: "ns", label: "UDP 1700" },
            { id: "ip2", from: "gw2", to: "ns", via: "y" },
            { id: "app", from: "ns", to: "as" },
        ],
    },
    steps: [{ id: "join" }, { id: "uplink" }, { id: "dedupe" }, { id: "decode" }, { id: "downlink" }],
    frames: [
        {
            id: "join-request",
            step: "join",
            from: "sensor",
            to: ["gw1", "gw2"],
            kind: "Join",
            name: "JoinRequest · DevNonce 7",
            time: "0.000",
            fields: [
                ["00", "type", "mhdr-join-request"],
                ["01 00 00 00 00 00 00 02", "address", "join-eui"],
                ["B3 07 00 00 00 44 1A 02", "address", "dev-eui"],
                ["07 00", "control", "devnonce"],
                ["FB A1 7A A2", "security", "mic-join"],
            ],
        },
        {
            id: "join-accept",
            step: "join",
            from: "ns",
            to: "sensor",
            kind: "Join",
            name: "JoinAccept · RX1 after 5 s",
            time: "5.062",
            fields: [
                ["20", "type", "mhdr-join-accept"],
                ["29 AB 75 D4 FB B6 47 86 49 8D 9F 1B 66 0C 50 F9", "security", "join-accept"],
            ],
        },
        {
            id: "uplink",
            step: "uplink",
            from: "sensor",
            to: ["gw1", "gw2"],
            kind: "Up",
            name: "Unconfirmed up · FCnt 0 · FPort 1",
            time: "12.000",
            fields: [
                ["40", "type", "mhdr-up"],
                DEVADDR,
                ["80", "control", "fctrl-up"],
                ["00 00", "control", "fcnt-up"],
                ["01", "address", "fport-1"],
                ["CF 2A 7D 56", "value", "frm-up"],
                ["24 7F FE 4A", "security", "mic-up"],
            ],
        },
        { id: "forward-1", step: "dedupe", from: "gw1", to: "ns", kind: "IP", name: "PUSH_DATA · -97 dBm", time: "12.054" },
        { id: "forward-2", step: "dedupe", from: "gw2", to: "ns", kind: "IP", name: "PUSH_DATA · -118 dBm", time: "12.061" },
        { id: "to-as", step: "decode", from: "ns", to: "as", kind: "IP", name: "Uplink · FPort 1", time: "12.262" },
        {
            id: "downlink",
            step: "downlink",
            from: "ns",
            to: "sensor",
            kind: "Down",
            name: "Unconfirmed down · RX1 · FPort 2",
            time: "13.051",
            fields: [
                ["60", "type", "mhdr-down"],
                DEVADDR,
                ["80", "control", "fctrl-down"],
                ["00 00", "control", "fcnt-down"],
                ["02", "address", "fport-2"],
                ["29 99 65", "value", "frm-down"],
                ["ED 17 8C 7B", "security", "mic-down"],
            ],
        },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "sensor",
        receiver: "as",
        rows: [
            { id: "temperature", address: "FPort 1 · 0–1", values: [["join", "46.3 °C", "–"], ["decode", "46.3 °C", "46.3 °C"]] },
            { id: "battery", address: "FPort 1 · 2–3", values: [["join", "3.600 V", "–"], ["decode", "3.600 V", "3.600 V"]] },
            { id: "interval", address: "FPort 2", values: [["join", "900 s", "900 s"], ["downlink", "600 s", "600 s"]] },
        ],
    },
    timing: {
        unit: "s",
        scale: "linear",
        end: 6,
        ticks: [0, 1, 2, 3, 4, 5, 6],
        tracks: [
            {
                id: "sends",
                events: [
                    { t: 0, mark: "event", label: "uplink" },
                    { t: 5.146, mark: "beat", label: "again" },
                ],
            },
            {
                id: "listens",
                events: [
                    { t: 1.051, mark: "event", label: "rx1" },
                    { t: 2.051, mark: "beat", label: "rx2" },
                ],
            },
        ],
    },
    anatomy: [
        {
            id: "datarate",
            parts: [
                ["SF7", "value", "dr-sf"],
                ["BW125", "value", "dr-bw"],
            ],
            also: "SF7BW125 = DR5 in EU868, about 5.5 kbit/s  ·  SF12BW125 = DR0, about 250 bit/s, reaches farthest",
        },
    ],
    playground: [{ kind: "file", sample: "decoder.js", file: codec, notes: { 4: "decode", 5: "port", 9: "order", 12: "signed", 13: "battery", 18: "encode" } }],
    related: ["m-bus", "mqtt", "dlms-cosem"],
};
