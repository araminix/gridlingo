import type { Lesson } from "../types";
import equipment from "./tso-a-eq.xml?raw";

// CIM is a model, not a wire: each "frame" here is a set of files or a message between control centres, so none carries
// bytes. What the files hold is the playground: an extract of TSO A's equipment file, in CGMES 2.4.15.
export const lesson: Lesson = {
    actors: ["tsoA", "tsoB", "opde", "rcc"],
    scene: {
        devices: [
            { id: "tsoA", kind: "scada", at: [0, 0], active: true },
            { id: "tsoB", kind: "scada", at: [0, 4.5] },
            { id: "opde", kind: "cloud", at: [4.5, 0], active: true },
            { id: "rcc", kind: "broker", at: [9, 0], active: true },
        ],
        links: [
            { id: "a", from: "tsoA", to: "opde", label: "CGMES · RDF/XML", active: true },
            { id: "b", from: "tsoB", to: "opde" },
            { id: "merge", from: "opde", to: "rcc", active: true },
        ],
    },
    steps: [{ id: "export" }, { id: "check" }, { id: "merge" }, { id: "analyse" }, { id: "act" }],
    frames: [
        { id: "igm-a", step: "export", from: "tsoA", to: "opde", kind: "CGMES", name: "IGM · TSO A · 2026-11-13 09:30Z · EQ SSH TP SV", time: "0.000" },
        { id: "igm-b", step: "export", from: "tsoB", to: "opde", kind: "CGMES", name: "IGM · TSO B · 2026-11-13 09:30Z · EQ SSH TP SV", time: "240.000" },
        { id: "qa-a", step: "check", from: "opde", to: "tsoA", kind: "Report", name: "Quality report · valid · 2 warnings", time: "300.000" },
        { id: "qa-b", step: "check", from: "opde", to: "tsoB", kind: "Report", name: "Quality report · valid", time: "540.000" },
        { id: "fetch", step: "merge", from: "opde", to: "rcc", kind: "CGMES", name: "IGMs + boundary set", time: "1800.000" },
        { id: "cgm", step: "merge", from: "rcc", to: "opde", kind: "CGMES", name: "CGM · 2026-11-13 09:30Z · SV", time: "2700.000" },
        { id: "result-a", step: "analyse", from: "rcc", to: "tsoA", kind: "Report", name: "N-1 · L-3 out → tie line 118 %", time: "3600.000" },
        { id: "result-b", step: "analyse", from: "rcc", to: "tsoB", kind: "Report", name: "N-1 · L-3 out → tie line 118 %", time: "3600.000" },
        { id: "remedy", step: "act", from: "tsoA", to: "rcc", kind: "Report", name: "Remedial action · redispatch 150 MW", time: "5400.000" },
    ],
    facts: ["standard", "between", "transport", "security", "speed"],
    points: {
        device: "tsoA",
        receiver: "rcc",
        rows: [
            { id: "igm", address: "09:30Z", values: [["export", "~sent", "–"], ["check", "~valid", "–"], ["merge", "~valid", "~merged"]] },
            { id: "tie", address: "SV", values: [["export", "612 MW", "–"], ["merge", "612 MW", "640 MW"]] },
            { id: "n1", address: "N-1", values: [["export", "–", "–"], ["analyse", "–", "118 %"], ["act", "–", "92 %"]] },
        ],
    },
    anatomy: [
        {
            id: "triple",
            parts: [
                ["cim:", "type", "a-ns"],
                ["Terminal", "type", "a-class"],
                [".ConductingEquipment", "address", "a-role"],
                ["#_8d4e3b21-6f0a-4c7e-9b52-d31f08a644c2", "value", "a-target"],
            ],
            also: '<cim:Terminal.ConductingEquipment rdf:resource="#_8d4e3b21-6f0a-4c7e-9b52-d31f08a644c2"/>',
        },
    ],
    playground: [
        {
            kind: "file",
            sample: "tso-a-eq.xml",
            file: equipment,
            notes: { 2: "namespaces", 3: "header", 4: "scenario", 5: "profile", 6: "authority", 8: "basevoltage", 11: "line", 13: "reference", 14: "length", 15: "impedance", 17: "charging", 19: "terminal", 22: "node" },
        },
    ],
    related: ["iccp", "iec-61850-mms", "iec-104", "c37-118"],
};
