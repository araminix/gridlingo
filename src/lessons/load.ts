import type { LanguageCode } from "@/i18n/languages";
import type { Lesson, LessonText } from "./types";

const lessons = import.meta.glob<Lesson>("./*/lesson.ts", { import: "lesson" });
const texts = import.meta.glob<LessonText>("./*/*.json", { import: "default" });

export interface Loaded {
    lesson: Lesson;
    text: LessonText;
    /** English, for anything a translation lacks. */
    english: LessonText;
}

/** A lesson and its texts in the language (English when there is no translation yet); null when there is no such lesson. */
export async function loadLesson(id: string, lang: LanguageCode): Promise<Loaded | null> {
    const loadData = lessons[`./${id}/lesson.ts`];
    const loadEnglish = texts[`./${id}/en.json`];
    if (!loadData || !loadEnglish) return null;
    const [lesson, english, text] = await Promise.all([loadData(), loadEnglish(), lang === "en" ? undefined : texts[`./${id}/${lang}.json`]?.()]);
    return { lesson, english, text: text ?? english };
}

/** The ids of the lessons that exist. */
export const lessonIds = () => Object.keys(lessons).map((path) => path.split("/")[1]!);
