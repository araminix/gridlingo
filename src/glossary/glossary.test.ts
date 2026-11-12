import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/i18n/languages";
import { termPattern, type Glossary } from "./glossary";

const files = import.meta.glob<Glossary>("./*.json", { eager: true, import: "default" });
const lessons = import.meta.glob<unknown>("../lessons/*/en.json", { eager: true, import: "default" });
const english = files["./en.json"]!;
const lessonText = Object.values(lessons).map((text) => JSON.stringify(text)).join("\n");

describe("the glossary", () => {
    it("explains every term in every language", () => {
        for (const { code } of LANGUAGES) {
            const glossary = files[`./${code}.json`];
            expect(glossary, `${code}.json`).toBeDefined();
            expect(Object.keys(glossary!).sort(), code).toEqual(Object.keys(english).sort());
            for (const [term, entry] of Object.entries(glossary!)) {
                expect(entry.full.trim(), `${code} ${term}.full`).not.toBe("");
                expect(entry.plain.trim(), `${code} ${term}.plain`).not.toBe("");
            }
        }
    });

    it("holds only terms the lessons use", () => {
        const pattern = termPattern(english)!;
        const used = new Set([...lessonText.matchAll(pattern)].map((match) => match[0]));
        expect(Object.keys(english).filter((term) => !used.has(term))).toEqual([]);
    });

    it("finds whole terms only", () => {
        const pattern = termPattern({ ACK: { full: "", plain: "" }, "RS-485": { full: "", plain: "" } })!;
        const found = (text: string) => [...text.matchAll(pattern)].map((match) => match[0]);
        expect(found("An ACK, then RS-485.")).toEqual(["ACK", "RS-485"]);
        expect(found("ACKs, C_ACK_1, PACK, $ACK")).toEqual([]);
        expect(found("RTU가 ACK를 보냅니다. RS-485は、ACKです。")).toEqual(["ACK", "RS-485", "ACK"]);
    });
});
