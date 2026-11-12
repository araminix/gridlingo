import type { LanguageCode } from "@/i18n/languages";

/** A term readers may not know: its full name and one plain sentence. Terms are written the same in every language. */
export interface Entry {
    full: string;
    plain: string;
}
export type Glossary = Record<string, Entry>;

const files = import.meta.glob<Glossary>("./*.json", { import: "default" });

/** The glossary in the language, each entry falling back to English while a translation lacks it. */
export async function loadGlossary(lang: LanguageCode): Promise<Glossary> {
    const [english, translated] = await Promise.all([files["./en.json"]!(), lang === "en" ? undefined : files[`./${lang}.json`]?.()]);
    return translated ? { ...english, ...translated } : english;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds the terms in a text: whole tokens only, so "ACK" is not found in "ACKs" or in "C_IC_NA_1". Longest first.
 * Only Latin letters and digits make a token longer: in "RTU가" or "RTUは" the particle follows without a space, and
 * the term is still found.
 */
export function termPattern(glossary: Glossary): RegExp | null {
    const terms = Object.keys(glossary).sort((a, b) => b.length - a.length);
    return terms.length ? new RegExp(`(?<![\\p{Script=Latin}\\p{N}_$])(?:${terms.map(escape).join("|")})(?![\\p{Script=Latin}\\p{N}_$])`, "gu") : null;
}
