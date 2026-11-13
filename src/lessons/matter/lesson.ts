import type { Lesson } from "../types";

// Matter messages are encrypted from the first password check on, so no frame shows bytes; what a person handles is
// the setup code on the charger's label, taken apart in the anatomy. Passcode 34207856, discriminator 2988.
export const lesson: Lesson = {
    actors: ["hub", "charger", "inverter"],
    scene: {
        devices: [
            { id: "hub", kind: "controller", at: [0, 0], address: "fd00::1", active: true },
            { id: "charger", kind: "charger", at: [5, 0], address: "fd00::17", active: true },
            { id: "inverter", kind: "inverter", at: [0, 4.5], address: "fd00::21" },
            { id: "car", kind: "car", at: [9, 0] },
        ],
        links: [
            { id: "wifi", from: "hub", to: "charger", label: "Matter · UDP 5540", radio: true, active: true },
            { id: "lan", from: "hub", to: "inverter", via: "y" },
            { id: "cable", from: "charger", to: "car" },
        ],
    },
    steps: [{ id: "commission" }, { id: "connect" }, { id: "subscribe" }, { id: "solar" }, { id: "cloud" }],
    frames: [
        { id: "pase", step: "commission", from: "hub", to: "charger", kind: "PASE", name: "PASE · SPAKE2+ · passcode from 2636-002-0873", time: "0.000" },
        { id: "attest", step: "commission", from: "charger", to: "hub", kind: "Matter", name: "Attestation · DAC → PAI → PAA", time: "1.200" },
        { id: "noc", step: "commission", from: "hub", to: "charger", kind: "Matter", name: "AddNOC · fabric 1 · node 0x17", time: "2.900" },
        { id: "network", step: "commission", from: "hub", to: "charger", kind: "Matter", name: "AddOrUpdateWiFiNetwork · ConnectNetwork", time: "3.400" },
        { id: "dnssd", step: "connect", from: "charger", to: "hub", kind: "DNS-SD", name: "_matter._tcp · node 0x17", time: "8.000" },
        { id: "case", step: "connect", from: "hub", to: "charger", kind: "CASE", name: "CASE · Sigma1, Sigma2, Sigma3", time: "8.300" },
        { id: "complete", step: "connect", from: "hub", to: "charger", kind: "Matter", name: "CommissioningComplete", time: "8.600" },
        { id: "subscribe", step: "subscribe", from: "hub", to: "charger", kind: "Matter", name: "SubscribeRequest · ActivePower · 10–60 s", time: "9.000" },
        { id: "report", step: "subscribe", from: "charger", to: "hub", kind: "Matter", name: "ReportData · ActivePower 0 mW", time: "9.100" },
        { id: "pv", step: "solar", from: "inverter", to: "hub", kind: "Matter", name: "ReportData · ActivePower −6 200 000 mW", time: "600.000" },
        { id: "enable", step: "solar", from: "hub", to: "charger", kind: "Matter", name: "Invoke · EnableCharging · until 18:00 · max 16 000 mA", time: "600.400" },
        { id: "charging", step: "solar", from: "charger", to: "hub", kind: "Matter", name: "ReportData · ActivePower 3 680 000 mW", time: "612.000" },
        { id: "pv-low", step: "cloud", from: "inverter", to: "hub", kind: "Matter", name: "ReportData · ActivePower −3 900 000 mW", time: "1500.000" },
        { id: "lower", step: "cloud", from: "hub", to: "charger", kind: "Matter", name: "Invoke · EnableCharging · max 6 000 mA", time: "1500.300" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "hub",
        receiver: "charger",
        rows: [
            { id: "fabric", address: "Fabric 1", values: [["commission", "~member", "~member"]] },
            { id: "limit", address: "EnergyEVSE", values: [["commission", "–", "–"], ["solar", "16 A", "16 A"], ["cloud", "6 A", "6 A"]] },
            { id: "power", address: "ActivePower", values: [["commission", "–", "0 kW"], ["solar", "3.68 kW", "3.68 kW"], ["cloud", "1.38 kW", "1.38 kW"]] },
        ],
    },
    anatomy: [
        {
            id: "code",
            parts: [
                ["2", "control", "a-first"],
                ["63600", "value", "a-middle"],
                ["2087", "value", "a-high"],
                ["3", "frame", "a-check"],
            ],
            also: "2636-002-0873  =  passcode 34207856  ·  discriminator 2988 (its top 4 bits, 11)",
        },
    ],
    playground: [{ kind: "encoder", type: "int32", order: "DCBA", value: 16000 }],
    related: ["eebus", "iec-61851", "ocpp", "mqtt"],
};
