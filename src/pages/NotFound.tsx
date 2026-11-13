import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n";
import { GroupIcon, groupVars } from "@/layout/GroupIcon";
import { SearchButton } from "@/layout/Search";
import { CATALOG } from "@/lessons/catalog";
import { Link, usePath } from "@/router";

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Protocols the address may have meant: a word of it found in a protocol's address or name, or the other way round. */
export function guessesFor(path: string) {
    const words = path.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && word !== "p");
    return CATALOG.filter((meta) => {
        const names = [squash(meta.id), squash(meta.name), ...meta.id.split("-").filter((part) => part.length >= 3)];
        return words.some((word) => names.some((name) => name.includes(word) || (name.length >= 4 && word.includes(name))));
    }).slice(0, 4);
}

/** An address with nothing behind it, drawn as an open circuit: what it was, what may have been meant, and ways on. */
export function NotFound() {
    const { t } = useI18n();
    const path = usePath();
    const guesses = guessesFor(path);
    useEffect(() => {
        document.title = `${t("notFound.title")} · Gridlingo`;
        return () => {
            document.title = "Gridlingo";
        };
    }, [t]);

    return (
        <main id="main" className="grid min-h-[calc(100vh-7.5rem)] place-items-center px-4 py-8">
            <div className="grid w-full max-w-4xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_15rem]">
                <div className="space-y-4">
                    <p className="font-mono text-sm font-semibold text-[var(--viz-alert)]">404 · {t("notFound.code")}</p>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("notFound.title")}</h1>
                    <p className="text-muted-foreground">{t("notFound.text")}</p>
                    <p dir="ltr" className="w-fit max-w-full truncate border bg-muted/50 px-2 py-1 font-mono text-sm rtl:ms-auto">
                        {path}
                    </p>
                    {guesses.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold">{t("notFound.guess")}</p>
                            <ul className="flex flex-wrap gap-2">
                                {guesses.map((meta) => (
                                    <li key={meta.id} style={groupVars(meta.group)}>
                                        <Link to={`/p/${meta.id}`} className="flex items-center gap-2 rounded-sm border bg-card py-1 ps-1 pe-3 text-sm font-medium hover:border-[var(--g)]">
                                            <GroupIcon group={meta.group} className="size-6" />
                                            {meta.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <SearchButton wide />
                    <Button asChild variant="outline">
                        <Link to="/">{t("notFound.back")}</Link>
                    </Button>
                </div>
                {/* A busbar, a feeder from it, and that feeder's breaker open: nothing flows past it */}
                <svg viewBox="0 0 240 300" className="mx-auto w-48 max-md:hidden md:w-full" aria-hidden="true">
                    <path d="M20,40 H220" stroke="var(--viz-energized)" strokeWidth={6} />
                    <path d="M120,40 V110" stroke="var(--viz-energized)" strokeWidth={3} />
                    <rect x={106} y={110} width={28} height={28} fill="var(--viz-ground)" stroke="var(--viz-alert)" strokeWidth={3} />
                    <path d="M120,138 V250" stroke="var(--viz-dead)" strokeWidth={3} strokeDasharray="6 6" />
                    <path d="M106,250 H134 L120,272 Z" fill="var(--viz-dead)" />
                    <text x={120} y={200} textAnchor="middle" className="fill-muted-foreground font-mono text-[40px] font-bold" paintOrder="stroke" stroke="var(--background)" strokeWidth={8}>
                        404
                    </text>
                </svg>
            </div>
        </main>
    );
}
