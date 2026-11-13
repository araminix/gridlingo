import type { Lesson } from "../types";
import forecast from "./forecast.json?raw";

// OSCP 2.0 is JSON over HTTPS between two back offices, so its messages are told in words; the forecast itself is the
// playground. Times are UTC: the evening peak, 18:00 to 21:00 in Central Europe, is 17:00 to 20:00Z.
export const lesson: Lesson = {
    actors: ["dso", "cpo", "charger1", "charger2"],
    scene: {
        devices: [
            { id: "dso", kind: "scada", at: [0, 0], active: true },
            { id: "cpo", kind: "cloud", at: [4.5, 0], address: "cpo.example.com", active: true },
            { id: "charger1", kind: "charger", at: [9, 0], address: "HUB17-01" },
            { id: "charger2", kind: "charger", at: [9, 4], address: "HUB17-02" },
            { id: "transformer", kind: "transformer", at: [13, 2] },
        ],
        links: [
            { id: "oscp", from: "dso", to: "cpo", label: "OSCP 2.0 · HTTPS", active: true },
            { id: "ocpp1", from: "cpo", to: "charger1" },
            { id: "ocpp2", from: "cpo", to: "charger2", via: "y" },
            { id: "feed1", from: "transformer", to: "charger1", via: "y" },
            { id: "feed2", from: "transformer", to: "charger2", via: "y" },
        ],
    },
    steps: [{ id: "register" }, { id: "forecast" }, { id: "plan" }, { id: "measure" }, { id: "offline" }],
    frames: [
        { id: "register", step: "register", from: "cpo", to: "dso", kind: "POST", name: "Register · token, version 2.0, URL" },
        { id: "handshake", step: "register", from: "dso", to: "cpo", kind: "POST", name: "Handshake · heartbeat every 300 s" },
        { id: "forecast", step: "forecast", from: "dso", to: "cpo", kind: "POST", name: "UpdateGroupCapacityForecast · hub-17 · 96 blocks" },
        { id: "accepted", step: "forecast", from: "cpo", to: "dso", kind: "Reply", name: "204 No Content" },
        { id: "profile1", step: "plan", from: "cpo", to: "charger1", kind: "OCPP", name: "SetChargingProfile · 17:00Z · 30 A" },
        { id: "profile2", step: "plan", from: "cpo", to: "charger2", kind: "OCPP", name: "SetChargingProfile · 17:00Z · 30 A" },
        { id: "measurements", step: "measure", from: "cpo", to: "dso", kind: "POST", name: "UpdateGroupMeasurements · 17:00–17:15Z · 61.8 kWh" },
        { id: "heartbeat", step: "offline", from: "dso", to: "cpo", kind: "POST", name: "Heartbeat · offline_mode_at 20:35Z (the last one)" },
        { id: "fallback", step: "offline", from: "cpo", to: "charger1", kind: "OCPP", name: "SetChargingProfile · fallback · 18 A" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "dso",
        receiver: "cpo",
        rows: [
            { id: "capacity", address: "17:00Z", values: [["register", "–", "–"], ["forecast", "250 kW", "250 kW"], ["offline", "–", "~fallback"]] },
            { id: "load", address: "hub-17", values: [["register", "–", "380 kW"], ["plan", "–", "247 kW"], ["offline", "–", "150 kW"]] },
            { id: "link", address: "Heartbeat", values: [["register", "~ok", "~ok"], ["offline", "~lost", "~lost"]] },
        ],
    },
    anatomy: [
        {
            id: "block",
            parts: [
                ['"capacity": 250', "value", "a-capacity"],
                ['"phase": "ALL"', "address", "a-phase"],
                ['"unit": "KW"', "type", "a-unit"],
                ['"start_time": "2026-11-13T17:00:00Z"', "time", "a-start"],
                ['"end_time": "2026-11-13T17:15:00Z"', "time", "a-end"],
            ],
            also: "250 kW for all phases together, from 18:00 to 18:15 Central European Time",
        },
    ],
    playground: [{ kind: "file", sample: "forecast.json", file: forecast, notes: { 2: "group", 3: "type", 4: "blocks", 5: "before", 6: "peak", 7: "same", 8: "after" } }],
    related: ["ocpp", "ocpi", "openadr", "eebus"],
};
