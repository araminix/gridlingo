import type { Lesson } from "../types";
import boot from "./boot-notification.json?raw";
import meter from "./transaction-event.json?raw";

export const lesson: Lesson = {
    actors: ["charger", "csms"],
    scene: {
        devices: [
            { id: "car", kind: "car", at: [0, 4.5] },
            { id: "charger", kind: "charger", at: [3, 2.5], address: "CS-0042", active: true },
            { id: "charger2", kind: "charger", at: [3, -0.5], address: "CS-0043" },
            { id: "csms", kind: "cloud", at: [7.5, 1], address: "csms.example.com", active: true },
        ],
        links: [
            { id: "cable", from: "charger", to: "car", via: "y" },
            { id: "ocpp", from: "charger", to: "csms", label: "OCPP 2.0.1 · wss", active: true },
            { id: "ocpp2", from: "charger2", to: "csms" },
        ],
    },
    steps: [{ id: "connect" }, { id: "boot" }, { id: "authorize" }, { id: "start" }, { id: "charge" }, { id: "stop" }],
    frames: [
        { id: "upgrade", step: "connect", from: "charger", to: "csms", kind: "HTTP", name: "GET /ocpp/CS-0042 · Upgrade", time: "0.000" },
        { id: "switch", step: "connect", from: "csms", to: "charger", kind: "HTTP", name: "101 Switching Protocols", time: "0.042" },
        {
            id: "boot",
            step: "boot",
            from: "charger",
            to: "csms",
            kind: "CALL",
            name: "BootNotification",
            time: "0.120",
            fields: [
                ["81", "frame", "ws-text"],
                ["FE", "size", "ws-mask-126"],
                ["00 AA", "size", "ws-len-170"],
                ["3A 7C 91 E5", "security", "ws-key"],
            ],
        },
        {
            id: "boot-conf",
            step: "boot",
            from: "csms",
            to: "charger",
            kind: "RESULT",
            name: "BootNotificationResponse · Accepted",
            time: "0.188",
            fields: [
                ["81", "frame", "ws-text"],
                ["58", "size", "ws-len-88"],
            ],
        },
        { id: "status", step: "boot", from: "charger", to: "csms", kind: "CALL", name: "StatusNotification · Available", time: "0.240" },
        { id: "status-conf", step: "boot", from: "csms", to: "charger", kind: "RESULT", name: "StatusNotificationResponse", time: "0.296" },
        { id: "authorize", step: "authorize", from: "charger", to: "csms", kind: "CALL", name: "Authorize · ISO14443", time: "95.210" },
        { id: "authorize-conf", step: "authorize", from: "csms", to: "charger", kind: "RESULT", name: "AuthorizeResponse · Accepted", time: "95.388" },
        { id: "started", step: "start", from: "charger", to: "csms", kind: "CALL", name: "TransactionEvent · Started", time: "131.050" },
        { id: "started-conf", step: "start", from: "csms", to: "charger", kind: "RESULT", name: "TransactionEventResponse · Accepted", time: "131.174" },
        { id: "updated", step: "charge", from: "charger", to: "csms", kind: "CALL", name: "TransactionEvent · Updated", time: "1031.050" },
        { id: "updated-conf", step: "charge", from: "csms", to: "charger", kind: "RESULT", name: "TransactionEventResponse", time: "1031.166" },
        { id: "ended", step: "stop", from: "charger", to: "csms", kind: "CALL", name: "TransactionEvent · Ended", time: "3731.050" },
        { id: "ended-conf", step: "stop", from: "csms", to: "charger", kind: "RESULT", name: "TransactionEventResponse", time: "3731.170" },
    ],
    facts: ["standard", "between", "transport", "security", "frames"],
    points: {
        device: "charger",
        receiver: "csms",
        rows: [
            { id: "card", address: "idTokenInfo", values: [["connect", "–", "–"], ["authorize", "Accepted", "Accepted"]] },
            { id: "tx", address: "transactionId", values: [["connect", "–", "–"], ["start", "TX-0187", "TX-0187"]] },
            {
                id: "energy",
                address: "meterValue",
                values: [
                    ["connect", "12840 Wh", "–"],
                    ["start", "12840 Wh", "12840 Wh"],
                    ["charge", "15600 Wh", "15600 Wh"],
                    ["stop", "23880 Wh", "23880 Wh"],
                ],
            },
        ],
    },
    timing: {
        unit: "s",
        scale: "linear",
        end: 960,
        ticks: [0, 300, 600, 900],
        tracks: [
            {
                id: "charger",
                events: [
                    { t: 0, mark: "event", label: "boot" },
                    { t: 300, mark: "repeat", label: "heartbeat" },
                    { t: 600, mark: "repeat" },
                    { t: 900, mark: "repeat" },
                ],
            },
            { id: "csms", events: [{ t: 8, mark: "beat", label: "interval" }] },
        ],
    },
    anatomy: [
        {
            id: "call",
            parts: [
                ["2", "frame", "a-type"],
                ['"1001"', "control", "a-id"],
                ['"BootNotification"', "type", "a-action"],
                ["{…}", "value", "a-payload"],
            ],
            also: '[2,"1001","BootNotification",{"reason":"PowerUp","chargingStation":{"serialNumber":"EX22-000042","model":"AC-22","vendorName":"ExampleVendor","firmwareVersion":"1.4.2"}}]',
        },
    ],
    playground: [
        { kind: "file", sample: "boot-notification.json", file: boot, notes: { 2: "call", 3: "message-id", 4: "action", 6: "reason", 9: "model", 11: "firmware" } },
        {
            kind: "file",
            sample: "transaction-event.json",
            file: meter,
            notes: { 2: "call", 3: "message-id", 4: "action", 6: "event-type", 7: "timestamp", 8: "trigger", 9: "seq", 11: "transaction-id", 12: "charging-state", 19: "energy", 21: "measurand", 23: "unit", 27: "power" },
        },
    ],
    related: ["ocpi", "iso-15118", "iec-61851"],
};
