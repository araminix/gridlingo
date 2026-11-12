import { describe, expect, it } from "vitest";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import { ROLES } from "@/viz/ByteInspector";
import { translate, type Dictionary, type Message } from "./i18n";
import { detectLanguage, directionOf, LANGUAGES } from "./languages";
import en from "./locales/en.json";

const locales = import.meta.glob<Dictionary>("./locales/*.json", { eager: true, import: "default" });
const placeholders = (text: string) => [...text.matchAll(/\{\{\w+\}\}/g)].map((match) => match[0]).sort();
const ruleCache = new Map<string, Set<string>>();
/** The plural forms a language uses for whole numbers, and "other". */
function formsFor(lang: string) {
    let forms = ruleCache.get(lang);
    if (!forms) {
        const rules = new Intl.PluralRules(lang);
        ruleCache.set(lang, (forms = new Set(["other", ...Array.from({ length: 1001 }, (_, n) => rules.select(n))])));
    }
    return forms;
}

describe("the interface texts", () => {
    it("exist in every language, with exactly the English messages and placeholders", () => {
        for (const { code } of LANGUAGES) {
            const messages = locales[`./locales/${code}.json`];
            expect(messages, `${code}.json`).toBeDefined();
            expect(Object.keys(messages!).sort(), code).toEqual(Object.keys(en).sort());
            for (const [key, english] of Object.entries(en) as [string, Message][]) {
                const message = messages![key as keyof Dictionary];
                if (typeof english === "string") {
                    expect(typeof message === "string" && message.trim(), `${code} ${key}`).toBeTruthy();
                    expect(placeholders(message as string), `${code} ${key}`).toEqual(placeholders(english));
                    continue;
                }
                expect(new Set(Object.keys(message as object)), `${code} ${key}: plural forms`).toEqual(formsFor(code));
                for (const text of Object.values(message as object)) expect(placeholders(text as string), `${code} ${key}`).toEqual(placeholders(english.other!));
            }
        }
    });

    it("name every group, device, colour and protocol of the library", () => {
        const keys = Object.keys(en);
        for (const group of GROUPS) expect(keys).toEqual(expect.arrayContaining([`group.${group}`, `group.${group}.sub`]));
        for (const role of ROLES) expect(keys).toContain(`role.${role}`);
        for (const meta of CATALOG) {
            expect(keys).toEqual(expect.arrayContaining([`lesson.${meta.id}.summary`, `lesson.${meta.id}.where`]));
            for (const device of meta.devices) expect(keys).toContain(`device.${device}`);
        }
    });

    it("write counts in the language's plural form and digits", () => {
        expect([1, 38].map((count) => translate({}, "home.library", { count }, "en"))).toEqual(["1 protocol", "38 protocols"]);
        expect(translate({}, "player.step", { n: 3, total: 6 }, "en")).toBe("Step 3 of 6");
    });

    it("pick the browser's language, and its direction", () => {
        expect(detectLanguage(["pt-BR", "en"])).toBe("pt");
        expect(detectLanguage(["sv-SE"])).toBe("en");
        expect(directionOf("fa")).toBe("rtl");
        expect(directionOf("de")).toBe("ltr");
    });
});
