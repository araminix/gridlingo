import type { Lesson } from "../types";
import app from "./supported-app-protocol.xml?raw";

export const lesson: Lesson = {
    actors: ["car", "charger"],
    scene: {
        devices: [
            { id: "car", kind: "car", at: [-1.5, 4], address: "fe80::ff:fe00:e1", active: true },
            { id: "charger", kind: "charger", at: [3.5, 1.5], address: "fe80::ff:fe00:a1", active: true },
            { id: "csms", kind: "cloud", at: [7.5, -0.5] },
        ],
        links: [
            { id: "plc", from: "charger", to: "car", label: "ISO 15118 · PLC", via: "y", active: true },
            { id: "ocpp", from: "charger", to: "csms" },
        ],
    },
    steps: [{ id: "plug" }, { id: "session" }, { id: "limits" }, { id: "prepare" }, { id: "charge" }, { id: "stop" }],
    frames: [
        { id: "cp", step: "plug", from: "charger", to: "car", kind: "CP", name: "PWM 5 % · state B", time: "0.000" },
        { id: "slac", step: "plug", from: "car", to: "charger", kind: "SLAC", name: "CM_SLAC_PARM … CM_SLAC_MATCH", time: "1.200" },
        {
            id: "sdp-req",
            step: "plug",
            from: "car",
            to: "charger",
            kind: "SDP",
            name: "SDP request · TLS, TCP",
            time: "4.010",
            fields: [
                ["01 FE", "frame", "version"],
                ["90 00", "type", "sdp-req"],
                ["00 00 00 02", "size", "len-2"],
                ["00", "security", "tls-req"],
                ["00", "control", "tcp"],
            ],
        },
        {
            id: "sdp-res",
            step: "plug",
            from: "charger",
            to: "car",
            kind: "SDP",
            name: "SDP response · port 54321",
            time: "4.015",
            fields: [
                ["01 FE", "frame", "version"],
                ["90 01", "type", "sdp-res"],
                ["00 00 00 14", "size", "len-20"],
                ["FE 80 00 00 00 00 00 00", "address", "ip-prefix"],
                ["00 00 00 FF FE 00 00 A1", "address", "ip-id"],
                ["D4 31", "address", "port"],
                ["00", "security", "tls-res"],
                ["00", "control", "tcp"],
            ],
        },
        { id: "tls", step: "session", from: "car", to: "charger", kind: "TLS", name: "TCP · TLS 1.2 handshake", time: "4.030" },
        { id: "app", step: "session", from: "car", to: "charger", kind: "EXI", name: "supportedAppProtocolReq", time: "4.210" },
        { id: "setup", step: "session", from: "charger", to: "car", kind: "EXI", name: "SessionSetupRes · OK_NewSessionEstablished", time: "4.330" },
        { id: "payment", step: "limits", from: "car", to: "charger", kind: "EXI", name: "PaymentServiceSelectionReq · ExternalPayment", time: "4.520" },
        { id: "params", step: "limits", from: "charger", to: "car", kind: "EXI", name: "ChargeParameterDiscoveryRes", time: "9.800" },
        { id: "cable-check", step: "prepare", from: "charger", to: "car", kind: "EXI", name: "CableCheckRes · Valid · Finished", time: "13.900" },
        { id: "pre-charge", step: "prepare", from: "car", to: "charger", kind: "EXI", name: "PreChargeReq · 396 V", time: "15.100" },
        { id: "power-on", step: "charge", from: "car", to: "charger", kind: "EXI", name: "PowerDeliveryReq · Start", time: "16.400" },
        { id: "current-demand", step: "charge", from: "car", to: "charger", kind: "EXI", name: "CurrentDemandReq · 120 A", time: "16.700" },
        { id: "stop", step: "stop", from: "car", to: "charger", kind: "EXI", name: "SessionStopReq · Terminate", time: "1860.200" },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "car",
        receiver: "charger",
        rows: [
            { id: "session", address: "SessionID", values: [["plug", "–", "–"], ["session", "4A1F09C27B3E8D15", "4A1F09C27B3E8D15"]] },
            {
                id: "soc",
                address: "EVRESSSOC",
                values: [
                    ["plug", "54 %", "–"],
                    ["limits", "54 %", "54 %"],
                    ["charge", "55 %", "55 %"],
                    ["stop", "80 %", "80 %"],
                ],
            },
            {
                id: "voltage",
                address: "EVSEPresentVoltage",
                values: [
                    ["plug", "–", "0 V"],
                    ["prepare", "395 V", "395 V"],
                    ["charge", "398 V", "398 V"],
                    ["stop", "0 V", "0 V"],
                ],
            },
            { id: "current", address: "EVTargetCurrent", values: [["plug", "–", "–"], ["charge", "120 A", "120 A"], ["stop", "0 A", "0 A"]] },
        ],
    },
    anatomy: [
        {
            id: "namespace",
            parts: [
                ["urn", "frame", "a-urn"],
                ["iso", "address", "a-body"],
                ["15118", "type", "a-standard"],
                ["2", "control", "a-part"],
                ["2013", "time", "a-year"],
                ["MsgDef", "value", "a-schema"],
            ],
            also: "urn:iso:15118:2:2013:MsgDef",
        },
    ],
    playground: [{ kind: "file", sample: "supported-app-protocol.xml", file: app, notes: { 2: "root", 4: "iso", 5: "version", 7: "schema-id", 8: "priority", 11: "din" } }],
    related: ["iec-61851", "ocpp", "ocpi"],
};
