import { describe, expect, it } from "vitest";
import { lesson } from "./lesson";
import rules from "./conduit-rules.txt?raw";

const lines = rules.replace(/\n$/, "").split("\n");
const rows = lines.filter((line) => line.trim() && !line.startsWith("#")).map((line) => line.trim().split(/\s+/));
const zones = new Map(rows.filter((row) => !/^C\d$/.test(row[0]!)).map((row) => [row[0]!, Number(row[1])]));
const conduits = rows.filter((row) => /^C\d$/.test(row[0]!)).map(([conduit, firewall, from, to, service, action, log, when]) => ({ conduit, firewall, from, to, service, action, log, when }));

/** The first rule of these conduits that matches the connection decides; "any" matches everything. */
function decide(from: string, to: string, service: string, through: readonly string[]) {
    const match = (rule: string | undefined, value: string) => rule === "any" || rule === value;
    return conduits.find((rule) => through.includes(rule.conduit!) && match(rule.from, from) && match(rule.to, to) && match(rule.service, service));
}

/** Each connection the lesson shows: who opens it, to whom, the service, and the conduits it crosses. */
const connections: Record<string, [from: string, to: string, service: string, through: string[]]> = {
    "scada-poll": ["scada", "inverters", "tcp/502", ["C3"]],
    "historian-read": ["historian", "scada", "tcp/4840", ["C2"]],
    "office-read": ["office", "historian", "tcp/443", ["C1"]],
    blocked: ["office", "inverters", "tcp/502", ["C1"]],
    "vendor-login": ["internet", "jump-host", "tcp/443", ["C1"]],
    "vendor-session": ["jump-host", "inverters", "tcp/443", ["C4"]],
};

describe("the IEC 62443 conduit rules", () => {
    it("decide every connection the way the lesson shows it", () => {
        for (const frame of lesson.frames) {
            if (frame.kind === "Reply") continue; // part of a connection already allowed
            const connection = connections[frame.id];
            expect(connection, `${frame.id} is a known connection`).toBeDefined();
            const rule = decide(...connection!);
            expect(rule?.action, frame.id).toBe(frame.kind === "Allow" ? "allow" : "deny");
            expect(rule?.log, `${frame.id} is logged`).toBe("yes");
        }
        expect(decide(...connections["vendor-session"]!)?.when, "vendor access only for an approved job").toBe("approved-job");
    });

    it("end every conduit with a rule that denies the rest", () => {
        for (const name of new Set(conduits.map((rule) => rule.conduit))) {
            const last = conduits.filter((rule) => rule.conduit === name).at(-1)!;
            expect([last.from, last.to, last.service, last.action], name).toEqual(["any", "any", "any", "deny"]);
        }
    });

    it("give the zones the target levels the lesson names", () => {
        expect(Object.fromEntries(zones)).toEqual({ enterprise: 1, dmz: 2, control: 3, field: 3 });
        const vector = lesson.anatomy!.find((anatomy) => anatomy.id === "vector")!;
        const levels = vector.parts.map(([part]) => Number(part.split(" ")[1]));
        expect(levels).toHaveLength(7);
        expect(Math.max(...levels), "the zone's level is its highest requirement").toBe(zones.get("control"));
        expect(vector.also).toBe(`SL-T(control) = { ${levels.join(" ")} }`);
    });

    it("put each playground note on the line it explains", () => {
        const file = lesson.playground!.find((item) => item.kind === "file")!;
        if (file.kind !== "file") throw new Error("a file playground");
        const expected: Record<string, string> = { enterprise: "enterprise", dmz: "dmz", control: "control", field: "field", office: "office", vendor: "internet", deny: "C1", historian: "historian", "scada-poll": "tcp/502", job: "approved-job" };
        for (const [line, note] of Object.entries(file.notes)) if (expected[note]) expect(lines[Number(line) - 1], `line ${line}: ${note}`).toContain(expected[note]);
        expect(lines[11], "the rule that stops the laptop").toMatch(/^C1 .* deny /);
    });
});
