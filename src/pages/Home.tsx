import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { Search } from "@/layout/Search";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import type { DeviceKind } from "@/lessons/types";
import { cn } from "@/lib/utils";
import { useDone } from "@/progress";
import { Link } from "@/router";

/** The devices worth filtering by, in the order a plant is walked through. */
const FILTERS: readonly DeviceKind[] = ["inverter", "battery", "turbine", "relay", "rtu", "meter", "charger", "scada"];
const START = ["iec-104", "iec-61850-goose", "modbus-tcp"];

export function Home() {
    const { t } = useI18n();
    const done = useDone();
    const [device, setDevice] = useState<DeviceKind | null>(null);
    const shown = CATALOG.filter((meta) => !device || meta.devices.includes(device));

    return (
        <main id="main" className="mx-auto max-w-[1440px] space-y-10 px-4 py-10 sm:px-8 sm:py-14">
            <section className="max-w-3xl space-y-5">
                <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">{t("home.title")}</h1>
                <p className="text-lg text-muted-foreground">{t("home.lead")}</p>
                <Search wide />
                <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{t("home.start")}</span>
                    {START.map((id) => (
                        <Link key={id} to={`/p/${id}`} className="rounded-full border bg-card px-3 py-1.5 font-medium hover:border-primary hover:text-primary">
                            {CATALOG.find((meta) => meta.id === id)!.name}
                        </Link>
                    ))}
                </p>
            </section>

            <section aria-labelledby="library" className="space-y-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <h2 id="library" className="text-2xl font-bold tracking-tight">
                        {t("home.library", { count: CATALOG.length })}
                    </h2>
                    <div role="group" aria-label={t("home.filter")} className="flex flex-wrap gap-2">
                        {[null, ...FILTERS].map((kind) => (
                            <button
                                key={kind ?? "all"}
                                type="button"
                                aria-pressed={device === kind}
                                onClick={() => setDevice(kind)}
                                className={cn(
                                    "min-h-10 rounded-full border px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    device === kind ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card hover:border-primary/60",
                                )}
                            >
                                {kind ? t(`device.${kind}` as MessageKey) : t("home.all")}
                            </button>
                        ))}
                    </div>
                </div>

                {GROUPS.map((group) => {
                    const items = shown.filter((meta) => meta.group === group);
                    if (!items.length) return null;
                    return (
                        <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <h3 id={`group-${group}`} className="text-xl font-bold">
                                    {t(`group.${group}` as MessageKey)}
                                </h3>
                                <p className="text-sm text-muted-foreground">{t(`group.${group}.sub` as MessageKey)}</p>
                            </div>
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3">
                                {items.map((meta) => (
                                    <li key={meta.id}>
                                        <Link
                                            to={`/p/${meta.id}`}
                                            className="flex h-full min-h-36 flex-col gap-2 rounded-xl border bg-card p-4 outline-none hover:border-primary/60 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="font-bold">{meta.name}</span>
                                                {done.includes(meta.id) && <CircleCheck className="size-4.5 shrink-0 text-primary" aria-label={t("home.done")} />}
                                            </span>
                                            <span className="text-sm text-muted-foreground">{t(`lesson.${meta.id}.summary` as MessageKey)}</span>
                                            <span className="mt-auto space-y-0.5">
                                                <span className="block text-xs text-muted-foreground">{t(`lesson.${meta.id}.where` as MessageKey)}</span>
                                                <span dir="ltr" className="block text-left font-mono text-xs rtl:text-right">
                                                    {meta.wire}
                                                </span>
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
            </section>
        </main>
    );
}
