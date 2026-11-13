import { CircleCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { GroupIcon, groupVars } from "@/layout/GroupIcon";
import { SearchButton } from "@/layout/Search";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import type { DeviceKind, Frame, Scene } from "@/lessons/types";
import { cn } from "@/lib/utils";
import { useDone } from "@/progress";
import { Link } from "@/router";
import { SiteScene, useReducedMotion } from "@/viz/SiteScene";

/** The devices worth filtering by, in the order a plant is walked through. */
const FILTERS: readonly DeviceKind[] = ["inverter", "battery", "turbine", "relay", "rtu", "meter", "charger", "scada"];
const START = ["iec-104", "iec-61850-goose", "modbus-tcp"];

/** A small grid for the top of the page: plants and a charger talking to a control room, one message at a time. */
export const HERO: Scene = {
    devices: [
        { id: "turbine", kind: "turbine", at: [0, 0] },
        { id: "pv", kind: "pv", at: [4.2, -1.6] },
        { id: "battery", kind: "battery", at: [6.8, 1.4] },
        { id: "relay", kind: "relay", at: [0.2, 3.6] },
        { id: "scada", kind: "scada", at: [3.6, 2.6], active: true },
        { id: "charger", kind: "charger", at: [5.6, 5.4] },
    ],
    links: [
        { id: "a", from: "turbine", to: "scada" },
        { id: "b", from: "pv", to: "scada", via: "y" },
        { id: "c", from: "battery", to: "scada", via: "y" },
        { id: "d", from: "relay", to: "scada" },
        { id: "e", from: "scada", to: "charger", via: "y" },
    ],
};
const HERO_FRAMES: Frame[] = [
    { id: "1", step: "", from: "turbine", to: "scada", kind: "", name: "" },
    { id: "2", step: "", from: "pv", to: "scada", kind: "", name: "" },
    { id: "3", step: "", from: "battery", to: "scada", kind: "", name: "" },
    { id: "4", step: "", from: "relay", to: "scada", kind: "", name: "" },
    { id: "5", step: "", from: "scada", to: "charger", kind: "", name: "" },
];

function HeroScene() {
    const { t } = useI18n();
    const [index, setIndex] = useState(0);
    // One message after another; a still picture for readers who ask for less motion
    const reduced = useReducedMotion();
    useEffect(() => {
        if (reduced) return;
        const timer = setInterval(() => setIndex((i) => (i + 1) % HERO_FRAMES.length), 2200);
        return () => clearInterval(timer);
    }, [reduced]);
    const words = useMemo(() => ({ device: (id: string) => t(`device.${HERO.devices.find((device) => device.id === id)!.kind}` as MessageKey) }), [t]);
    return <SiteScene scene={HERO} frame={reduced ? undefined : HERO_FRAMES[index]} words={words} plate />;
}

export function Home() {
    const { t } = useI18n();
    const done = useDone();
    const [device, setDevice] = useState<DeviceKind | null>(null);
    const shown = CATALOG.filter((meta) => !device || meta.devices.includes(device));

    return (
        <main id="main">
            <section className="border-b bg-[radial-gradient(60rem_30rem_at_85%_-10%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent),radial-gradient(40rem_24rem_at_0%_110%,color-mix(in_oklab,var(--gold)_18%,transparent),transparent)]">
                <div className="mx-auto grid max-w-[1440px] items-center gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                    <div className="max-w-3xl space-y-4">
                        <p className="inline-flex items-center gap-2 rounded-sm border border-[color-mix(in_oklab,var(--gold)_45%,transparent)] bg-gold-soft px-3 py-1 text-sm font-medium text-gold-foreground">
                            {t("home.badge", { count: CATALOG.length })}
                        </p>
                        <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{t("home.title")}</h1>
                        <p className="text-muted-foreground sm:text-lg">{t("home.lead")}</p>
                        <SearchButton wide />
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{t("home.start")}</span>
                            {START.map((id) => (
                                <Link key={id} to={`/p/${id}`} className="rounded-sm border bg-card px-3 py-1.5 font-medium hover:border-primary hover:text-primary">
                                    {CATALOG.find((meta) => meta.id === id)!.name}
                                </Link>
                            ))}
                        </p>
                    </div>
                    <div className="hidden lg:block" aria-hidden="true">
                        <HeroScene />
                    </div>
                </div>
            </section>

            <section aria-labelledby="library" className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <h2 id="library" className="text-2xl font-bold tracking-tight">
                        {t("home.library", { count: CATALOG.length })}
                    </h2>
                    {/* On a phone the filters are one row that scrolls sideways, running to the screen's edges */}
                    <div
                        role="group"
                        aria-label={t("home.filter")}
                        className="-mx-4 -my-1 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] sm:m-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:p-0"
                    >
                        {[null, ...FILTERS].map((kind) => (
                            <button
                                key={kind ?? "all"}
                                type="button"
                                aria-pressed={device === kind}
                                onClick={() => setDevice(kind)}
                                className={cn(
                                    "min-h-9 shrink-0 rounded-sm border px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                        <section key={group} aria-labelledby={`group-${group}`} className="space-y-2.5" style={groupVars(group)}>
                            <div className="flex items-center gap-2.5">
                                <GroupIcon group={group} className="size-8" />
                                <div>
                                    <h3 id={`group-${group}`} className="text-lg leading-tight font-bold">
                                        {t(`group.${group}` as MessageKey)}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{t(`group.${group}.sub` as MessageKey)}</p>
                                </div>
                            </div>
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
                                {items.map((meta) => (
                                    <li key={meta.id}>
                                        <Link
                                            to={`/p/${meta.id}`}
                                            className="relative flex h-full flex-col gap-1.5 overflow-hidden rounded-xl border bg-[linear-gradient(180deg,color-mix(in_oklab,var(--g)_7%,var(--card)),var(--card)_60%)] p-3 pt-4 outline-none transition-colors hover:border-[var(--g)] focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[var(--g)]" />
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="font-bold">{meta.name}</span>
                                                {done.includes(meta.id) && <CircleCheck className="size-5 shrink-0 fill-gold-soft text-gold-foreground" aria-label={t("home.done")} />}
                                            </span>
                                            <span className="text-sm text-muted-foreground">{t(`lesson.${meta.id}.summary` as MessageKey)}</span>
                                            <span className="mt-auto space-y-1">
                                                <span className="block text-xs text-muted-foreground">{t(`lesson.${meta.id}.where` as MessageKey)}</span>
                                                <span dir="ltr" className="inline-block rounded-sm bg-[color-mix(in_oklab,var(--g)_10%,transparent)] px-1.5 py-0.5 text-left font-mono text-xs text-[var(--g)] rtl:text-right">
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
