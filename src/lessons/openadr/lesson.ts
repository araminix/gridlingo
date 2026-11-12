import type { Lesson } from "../types";
import event from "./event.xml?raw";

export const lesson: Lesson = {
    actors: ["vtn", "ven", "bms"],
    scene: {
        devices: [
            { id: "vtn", kind: "cloud", at: [-1.5, 2], address: "vtn.utility.example", active: true },
            { id: "ven", kind: "gateway", at: [5.5, 2], address: "10.0.7.5", active: true },
            { id: "bms", kind: "controller", at: [5.5, 6], address: "10.0.7.10" },
            { id: "building", kind: "building", at: [10.5, 6] },
        ],
        links: [
            { id: "oadr", from: "vtn", to: "ven", label: "OpenADR 2.0b · HTTPS", active: true },
            { id: "bacnet", from: "ven", to: "bms", label: "BACnet/IP", via: "y" },
            { id: "plant", from: "bms", to: "building" },
        ],
    },
    steps: [{ id: "poll" }, { id: "optin" }, { id: "shed" }, { id: "report" }, { id: "end" }],
    frames: [
        { id: "tls", step: "poll", from: "ven", to: "vtn", kind: "TLS", name: "TLS 1.2 · both certificates", time: "0.000" },
        { id: "poll", step: "poll", from: "ven", to: "vtn", kind: "HTTP", name: "oadrPoll", time: "0.150" },
        { id: "distribute", step: "poll", from: "vtn", to: "ven", kind: "HTTP", name: "oadrDistributeEvent", time: "0.210" },
        { id: "created", step: "optin", from: "ven", to: "vtn", kind: "HTTP", name: "oadrCreatedEvent · optIn", time: "0.480" },
        { id: "response", step: "optin", from: "vtn", to: "ven", kind: "HTTP", name: "oadrResponse · 200", time: "0.530" },
        { id: "shed", step: "shed", from: "ven", to: "bms", kind: "BACnet", name: "WriteProperty", time: "18000.000" },
        { id: "update-report", step: "report", from: "ven", to: "vtn", kind: "HTTP", name: "oadrUpdateReport", time: "18900.000" },
        { id: "updated-report", step: "report", from: "vtn", to: "ven", kind: "HTTP", name: "oadrUpdatedReport · 200", time: "18900.060" },
        { id: "restore", step: "end", from: "ven", to: "bms", kind: "BACnet", name: "WriteProperty · NULL", time: "21600.000" },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "ven",
        receiver: "vtn",
        rows: [
            { id: "status", address: "eventStatus", values: [["poll", "far", "far"], ["shed", "active", "active"], ["end", "completed", "completed"]] },
            { id: "opt", address: "optType", values: [["poll", "–", "–"], ["optin", "optIn", "optIn"]] },
            { id: "load", address: "TELEMETRY_USAGE", values: [["poll", "420 kW", "420 kW"], ["shed", "340 kW", "420 kW"], ["report", "340 kW", "340 kW"], ["end", "415 kW", "340 kW"]] },
        ],
    },
    anatomy: [
        {
            id: "endpoint",
            parts: [
                ["https://vtn.utility.example", "address", "a-host"],
                ["/OpenADR2/Simple", "type", "a-transport"],
                ["/2.0b", "control", "a-profile"],
                ["/OadrPoll", "value", "a-service"],
            ],
            also: ".../OpenADR2/Simple/2.0b/ EiEvent · EiReport · EiRegisterParty · EiOpt · OadrPoll",
        },
    ],
    playground: [
        {
            kind: "file",
            sample: "event.xml",
            file: event,
            notes: {
                2: "payload",
                9: "signed",
                10: "distribute",
                12: "vtn",
                16: "event-id",
                17: "modification",
                19: "market",
                22: "status",
                23: "test",
                28: "start",
                31: "length",
                48: "level",
                53: "simple",
                58: "current",
                64: "target",
                67: "response",
            },
        },
    ],
    related: ["ieee-2030-5", "bacnet", "iec-62443"],
};
