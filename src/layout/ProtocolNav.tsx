import { CircleCheck } from "lucide-react";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import { cn } from "@/lib/utils";
import { GroupIcon, groupVars } from "./GroupIcon";
import { useDone } from "@/progress";
import { Link } from "@/router";

/** Every protocol by group, the current one marked; `onPick` closes the sheet it sits in on a phone. */
export function ProtocolNav({ current, onPick }: { current: string; onPick?: () => void }) {
    const { t } = useI18n();
    const done = useDone();
    return (
        <nav aria-label={t("nav.protocols")} className="space-y-4">
            <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t("nav.progress", { done: done.length, total: CATALOG.length })}</p>
                <p className="text-xs text-muted-foreground">{t("nav.progressHint")}</p>
                <div className="h-1.5 bg-muted" aria-hidden="true">
                    <div className="h-1.5 bg-[linear-gradient(90deg,var(--primary),var(--gold))]" style={{ width: `${(done.length / CATALOG.length) * 100}%` }} />
                </div>
            </div>
            {GROUPS.map((group) => (
                <div key={group} className="space-y-1" style={groupVars(group)}>
                    <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-wider text-[var(--g)] uppercase">
                        <GroupIcon group={group} className="size-6" />
                        {t(`group.${group}` as MessageKey)}
                    </h2>
                    <ul>
                        {CATALOG.filter((meta) => meta.group === group).map((meta) => (
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
