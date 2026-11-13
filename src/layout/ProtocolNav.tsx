import { CircleCheck, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import { cn } from "@/lib/utils";
import { GroupIcon, groupVars } from "./GroupIcon";
import { useDone } from "@/progress";
import { Link } from "@/router";
import { wordsOf } from "./Search";

/**
 * Every protocol by group, the current one marked, with a field that narrows the list as the reader types (by the same
 * words as the search); `onPick` closes the sheet it sits in on a phone.
 */
export function ProtocolNav({ current, onPick }: { current: string; onPick?: () => void }) {
    const { t } = useI18n();
    const done = useDone();
    const [query, setQuery] = useState("");
    const asked = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const shown = CATALOG.filter((meta) => {
        const words = wordsOf(meta, t).join(" ").toLocaleLowerCase();
        return asked.every((word) => words.includes(word));
    });
    return (
        <nav aria-label={t("nav.protocols")} className="space-y-4">
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("nav.progress", { done: done.length, total: CATALOG.length })}</p>
                <p className="text-xs text-muted-foreground">{t("nav.progressHint")}</p>
                <div className="h-1.5 bg-muted" aria-hidden="true">
                    <div className="h-1.5 bg-[linear-gradient(90deg,var(--primary),var(--gold))]" style={{ width: `${(done.length / CATALOG.length) * 100}%` }} />
                </div>
            </div>
            <div className="sticky top-0 z-10 bg-background py-1">
                <Search aria-hidden="true" className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("nav.filter")} aria-label={t("nav.filter")} className="h-9 ps-8" />
            </div>
            {!shown.length && <p className="px-1 text-sm text-muted-foreground">{t("search.empty")}</p>}
            {GROUPS.filter((group) => shown.some((meta) => meta.group === group)).map((group) => (
                <div key={group} className="space-y-1" style={groupVars(group)}>
                    <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-wider text-[var(--g)] uppercase">
                        <GroupIcon group={group} className="size-6" />
                        {t(`group.${group}` as MessageKey)}
                    </h2>
                    <ul className="divide-y border-y">
                        {shown.filter((meta) => meta.group === group).map((meta) => (
                            <li key={meta.id}>
                                <Link
                                    to={`/p/${meta.id}`}
                                    onClick={onPick}
                                    aria-current={meta.id === current ? "page" : undefined}
                                    className={cn(
                                        "flex min-h-8 items-center justify-between gap-2 rounded-md px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        meta.id === current
                                            ? "border-s-[3px] border-[var(--g)] bg-[color-mix(in_oklab,var(--g)_12%,transparent)] font-semibold text-foreground"
                                            : "border-s-[3px] border-transparent hover:bg-[color-mix(in_oklab,var(--g)_7%,transparent)]",
                                    )}
                                >
                                    <span>{meta.name}</span>
                                    {done.includes(meta.id) && <CircleCheck className="size-4 shrink-0 fill-gold-soft text-gold-foreground" aria-label={t("home.done")} />}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
