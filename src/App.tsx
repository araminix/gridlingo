import { useI18n } from "@/i18n/i18n";
import { Footer, Header } from "@/layout/Header";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";
import { usePath } from "@/router";
import { lazy, Suspense } from "react";
import { Direction } from "radix-ui";

// The lesson page (its diagrams and playgrounds) loads when a lesson is opened, not with the home page
const LessonPage = lazy(() => import("@/pages/Lesson").then((module) => ({ default: module.LessonPage })));

export function App() {
    const { t, dir } = useI18n();
    const path = usePath();
    const lesson = /^\/p\/([a-z0-9-]+)$/.exec(path)?.[1];
    // Radix's parts (tabs, menus, the sheet) take their reading direction from here, not from the page: without it they
    // stay left to right in Arabic and Persian
    return (
        <Direction.Provider dir={dir}>
            <a href="#main" className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
                {t("app.skip")}
            </a>
            <Header />
            {path === "/" ? (
                <Home />
            ) : lesson ? (
                <Suspense fallback={<main id="main" className="min-h-[60vh]" aria-busy="true" />}>
                    <LessonPage id={lesson} />
                </Suspense>
            ) : (
                <NotFound />
            )}
            <Footer />
        </Direction.Provider>
    );
}
