import { CircleCheck } from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import { cn } from "@/lib/utils";
import { useDone } from "@/progress";
import { Link } from "@/router";

/** Every protocol by group, the current one marked; `onPick` closes the sheet it sits in on a phone. */
export function ProtocolNav({ current, onPick }: { current: string; onPick?: () => void }) {
    const { t } = useI18n();
    const done = useDone();
    return (
        <nav aria-label={t("nav.protocols")} className="space-y-5">
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("nav.progress", { done: done.length, total: CATALOG.length })}</p>
                <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(done.length / CATALOG.length) * 100}%` }} />
                </div>
            </div>
            {GROUPS.map((group) => (
                <div key={group} className="space-y-1">
                    <h2 className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{t(`group.${group}` as MessageKey)}</h2>
                    <ul>
                        {CATALOG.filter((meta) => meta.group === group).map((meta) => (
                            <li key={meta.id}>
                                <Link
                                    to={`/p/${meta.id}`}
                                    onClick={onPick}
                                    aria-current={meta.id === current ? "page" : undefined}
                                    className={cn(
                                        "flex min-h-9 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        meta.id === current ? "bg-accent font-semibold text-accent-foreground" : "hover:bg-muted",
                                    )}
                                >
                                    <span>{meta.name}</span>
                                    {done.includes(meta.id) && <CircleCheck className="size-4 shrink-0 text-primary" aria-label={t("home.done")} />}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </nav>
    );
}
