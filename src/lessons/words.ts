import type { FactKey, LessonText } from "./types";

/** A lesson's texts in the chosen language, each one falling back to English while a translation lacks it. */
export function wordsOf(text: LessonText, english: LessonText) {
    const pick = <T>(group: (texts: LessonText) => Record<string, T> | undefined, key: string): T | undefined => group(text)?.[key] ?? group(english)?.[key];
    return {
        intro: text.intro || english.intro,
        plain: text.plain || english.plain,
        tips: text.tips.length ? text.tips : english.tips,
        step: (id: string) => pick((t) => t.steps, id) ?? { title: id, text: "" },
        frame: (id: string) => pick((t) => t.frames, id) ?? "",
        note: (id: string) => pick((t) => t.notes, id),
        field: (key: string) => pick((t) => t.fields, key) ?? { name: key, note: "" },
        device: (id: string) => pick((t) => t.devices, id) ?? id,
        fact: (key: FactKey) => pick((t) => t.facts, key),
        point: (id: string) => pick((t) => t.points, id) ?? id,
        /** A value as written, or translated when it starts with "~". */
        value: (value: string) => (value.startsWith("~") ? (pick((t) => t.values, value.slice(1)) ?? value.slice(1)) : value),
        anatomy: (id: string) => pick((t) => t.anatomy, id) ?? id,
        timing: (key: string) => pick((t) => t.timing, key) ?? key,
        singleLine: (key: string) => pick((t) => t.singleLine, key) ?? key,
        playground: (key: string) => pick((t) => t.playground, key) ?? "",
    };
}

export type Words = ReturnType<typeof wordsOf>;
