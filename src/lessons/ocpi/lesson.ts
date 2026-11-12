import type { Lesson } from "../types";
import cdr from "./cdr.json?raw";
import location from "./location.json?raw";

export const lesson: Lesson = {
    actors: ["cpo", "emsp"],
    scene: {
        devices: [
            { id: "car", kind: "car", at: [0, 5] },
            { id: "charger", kind: "charger", at: [2.5, 2.5], address: "NL*ABC*E12345*1" },
            { id: "cpo", kind: "cloud", at: [5.5, 1], address: "cpo.example.com", active: true },
            { id: "emsp", kind: "cloud", at: [10.5, 1], address: "emsp.example.net", active: true },
        ],
        links: [
            { id: "cable", from: "charger", to: "car", via: "y" },
            { id: "ocpp", from: "charger", to: "cpo" },
            { id: "ocpi", from: "cpo", to: "emsp", label: "OCPI 2.2.1 · HTTPS", active: true },
        ],
    },
    steps: [{ id: "discover" }, { id: "register" }, { id: "location" }, { id: "authorize" }, { id: "session" }, { id: "cdr" }],
    frames: [
        { id: "versions", step: "discover", from: "emsp", to: "cpo", kind: "GET", name: "GET /ocpi/versions" },
        { id: "endpoints", step: "discover", from: "cpo", to: "emsp", kind: "Reply", name: "2.2.1 · endpoints" },
        { id: "post-credentials", step: "register", from: "emsp", to: "cpo", kind: "POST", name: "POST /ocpi/2.2.1/credentials" },
        { id: "check", step: "register", from: "cpo", to: "emsp", kind: "GET", name: "GET /ocpi/versions · token B" },
        { id: "credentials", step: "register", from: "cpo", to: "emsp", kind: "Reply", name: "credentials · token C" },
        { id: "put-location", step: "location", from: "cpo", to: "emsp", kind: "PUT", name: "PUT …/locations/NL/ABC/LOC-0042" },
        { id: "location-ok", step: "location", from: "emsp", to: "cpo", kind: "Reply", name: "status_code 1000" },
        { id: "authorize", step: "authorize", from: "cpo", to: "emsp", kind: "POST", name: "POST …/tokens/04A2B3C4D5E6F7/authorize" },
        { id: "allowed", step: "authorize", from: "emsp", to: "cpo", kind: "Reply", name: "allowed · ALLOWED" },
        { id: "put-session", step: "session", from: "cpo", to: "emsp", kind: "PUT", name: "PUT …/sessions/NL/ABC/SES-0187" },
        { id: "patch-session", step: "session", from: "cpo", to: "emsp", kind: "PATCH", name: "PATCH …/sessions/NL/ABC/SES-0187" },
        { id: "post-cdr", step: "cdr", from: "cpo", to: "emsp", kind: "POST", name: "POST …/cdrs" },
        { id: "cdr-ok", step: "cdr", from: "emsp", to: "cpo", kind: "Reply", name: "status_code 1000 · Location" },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "cpo",
        receiver: "emsp",
        rows: [
            { id: "to-cpo", address: "eMSP → CPO", values: [["discover", "~token-a", "~token-a"], ["register", "~token-c", "~token-c"]] },
            { id: "to-emsp", address: "CPO → eMSP", values: [["discover", "–", "–"], ["register", "~token-b", "~token-b"]] },
            { id: "kwh", address: "kwh", values: [["discover", "–", "–"], ["session", "6.25", "6.25"], ["cdr", "12.5", "12.5"]] },
            { id: "cost", address: "total_cost", values: [["discover", "–", "–"], ["cdr", "6.05 EUR", "6.05 EUR"]] },
        ],
    },
    anatomy: [
        {
            id: "evse-id",
            parts: [
                ["NL", "address", "a-country"],
                ["ABC", "cause", "a-operator"],
                ["E", "type", "a-type"],
                ["12345*1", "value", "a-evse"],
            ],
            also: "NL*ABC*E12345*1",
        },
        {
            id: "url",
            parts: [
                ["https://emsp.example.net/ocpi/2.2.1/locations", "frame", "u-endpoint"],
                ["NL", "address", "u-country"],
                ["ABC", "cause", "u-party"],
                ["LOC-0042", "value", "u-location"],
            ],
            also: "https://emsp.example.net/ocpi/2.2.1/locations/NL/ABC/LOC-0042",
        },
    ],
    playground: [
        {
            kind: "file",
            sample: "location.json",
            file: location,
            notes: { 2: "owner", 4: "location-id", 5: "publish", 10: "country", 12: "coordinates", 18: "evse-uid", 19: "evse-id", 20: "status", 25: "standard", 28: "max-voltage", 30: "max-power", 31: "tariff", 38: "time-zone", 39: "last-updated" },
        },
        {
            kind: "file",
            sample: "cdr.json",
            file: cdr,
            notes: { 4: "cdr-id", 7: "session-id", 8: "cdr-token", 13: "contract", 15: "auth-method", 16: "cdr-location", 33: "currency", 34: "periods", 38: "dimensions", 45: "excl-vat", 46: "incl-vat", 48: "total-energy", 49: "total-time" },
        },
    ],
    related: ["ocpp", "iso-15118"],
};
