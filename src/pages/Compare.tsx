import { Check, Minus } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { GroupIcon, groupVars } from "@/layout/GroupIcon";
import { metaOf } from "@/lessons/catalog";
import { loadLesson, type Loaded } from "@/lessons/load";
import type { Field, FieldRole } from "@/lessons/types";
import { wordsOf } from "@/lessons/words";
import { cn } from "@/lib/utils";
import { Link } from "@/router";
import { byteCount, roleColor } from "@/viz/ByteInspector";
import { COMPARED, MAX_COMPARED, pickedFrom } from "./compared";

type Fact = "time" | "quality" | "reason";

/** A protocol on the page: the frame in which it tells the trip, and what that frame can say. */
interface Column {
    lesson: string;
    /** The frame in its lesson (its bytes are proven there), or null when the bytes are given here. */
    frame: string | null;
    /** Bytes given here when the lesson has no such frame; each key is a compare.modbus.<key> text. */
    own?: readonly Field[];
    /** About when the receiver knows, in milliseconds after the fault: it orders the timeline. */
    after: number;
    /** The receiver has to ask before it learns anything. */
    polled: boolean;
    /** What the frame says about when, how sure and why; its words are compare.<lesson>.<fact>. */
    carries: readonly Fact[];
}

// In the picker's order (COMPARED). Modbus has no event to send: its column is the answer to the poll that finds the breaker open. The MBAP length
// (00 04) counts the bytes after it: the unit, the function code, the byte count and the inputs.
export const COLUMNS: readonly Column[] = [
    { lesson: "iec-61850-goose", frame: "event", after: 3, polled: false, carries: ["time", "quality"] },
    { lesson: "iec-104", frame: "trip", after: 100, polled: false, carries: ["time", "quality", "reason"] },
    { lesson: "iec-101", frame: "trip", after: 200, polled: true, carries: ["time", "quality", "reason"] },
    { lesson: "iec-103", frame: "trip", after: 100, polled: true, carries: ["time", "reason"] },
    { lesson: "dnp3", frame: "unsolicited", after: 100, polled: false, carries: ["time", "quality"] },
    {
        lesson: "modbus-tcp",
        frame: null,
        own: [
            ["00 05", "control", "tid"],
            ["00 00", "control", "pid"],
            ["00 04", "size", "len"],
            ["01", "address", "unit"],
            ["02", "type", "fc"],
            ["01", "size", "count"],
            ["00", "value", "status"],
        ],
        after: 1000,
        polled: true,
        carries: [],
    },
];

/** The meanings a reader can light up in every frame at once. */
const KEYS: readonly FieldRole[] = ["value", "time", "quality", "cause", "address"];
/** When nothing is lit, each card names only the parts that tell the news. */
const NEWS: readonly FieldRole[] = ["value", "time", "quality", "cause"];
/** About when the breaker is open after the fault: the relay trips, then the breaker takes about three cycles. */
const BREAKER_OPEN = 60;

/** The trip told by the protocols the reader picks (up to four of six): a timeline, their frames and a table. */
export function Compare() {
    const { t, lang } = useI18n();
    const [picked, setPicked] = useState(() => pickedFrom(location.search));
    const [loaded, setLoaded] = useState<Record<string, Loaded | null>>({});
    const [lit, setLit] = useState<FieldRole | null>(null);

    // The choice lives in the address, so a link can open the page on it and Back restores it
    useEffect(() => {
        const read = () => setPicked(pickedFrom(location.search));
        addEventListener("popstate", read);
        return () => removeEventListener("popstate", read);
    }, []);
    const toggle = (id: string) => {
        const next = picked.includes(id) ? picked.filter((item) => item !== id) : COMPARED.filter((item) => item === id || picked.includes(item));
        setPicked(next);
        history.replaceState(null, "", `${location.pathname}?p=${next.join(",")}`);
    };

    useEffect(() => {
        let current = true;
        void Promise.all(COLUMNS.map((column) => loadLesson(column.lesson, lang).then((result) => [column.lesson, result] as const))).then(
            (list) => current && setLoaded(Object.fromEntries(list)),
        );
        return () => {
            current = false;
        };
    }, [lang]);

    useEffect(() => {
        document.title = `${t("compare.title")} · Gridlingo`;
        return () => {
            document.title = "Gridlingo";
        };
    }, [t]);

    const text = (lesson: string, key: string) => t(`compare.${lesson}.${key}` as MessageKey);
    // Each picked column's bytes with their labels, from its lesson or given above
    const columns = COLUMNS.filter((column) => picked.includes(column.lesson)).map((column) => {
        const meta = metaOf(column.lesson)!;
        if (column.own) return { column, meta, fields: column.own.map(([hex, role, key]) => ({ hex, role, label: t(`compare.modbus.${key}` as MessageKey) })) };
        const data = loaded[column.lesson];
        if (!data) return { column, meta, fields: [] };
        const words = wordsOf(data.text, data.english);
        const frame = data.lesson.frames.find((item) => item.id === column.frame)!;
        return { column, meta, fields: (frame.fields ?? []).map(([hex, role, key]) => ({ hex, role, label: words.field(key).name })) };
    });
    const bytesOf = (fields: { hex: string }[]) => fields.reduce((sum, field) => sum + byteCount(field.hex), 0);

    // From the fault to the last picked protocol telling someone: digits as the delays are written, in Latin
    const ms = new Intl.NumberFormat(lang, { style: "unit", unit: "millisecond", unitDisplay: "short", numberingSystem: "latn" });
    const timeline = [
        { after: 0, at: ms.format(0), what: t("compare.fault"), group: null },
        { after: BREAKER_OPEN, at: `≈ ${ms.format(BREAKER_OPEN)}`, what: t("compare.open"), group: null },
        ...columns.map(({ column, meta }) => ({ after: column.after, at: text(column.lesson, "when"), what: `${meta.name}: ${text(column.lesson, "moment")}`, group: meta.group })),
    ].sort((a, b) => a.after - b.after);

    // The table's rows: what each protocol does, and what its frame can say
    type View = (typeof columns)[number];
    const fact = (key: Fact) => (c: View) =>
        c.column.carries.includes(key) ? (
            <span className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--viz-ok)]" aria-hidden="true" /> {text(c.column.lesson, key)}
            </span>
        ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
                <Minus className="size-4 shrink-0" aria-hidden="true" /> {t("compare.notCarried")}
            </span>
        );
    const rows: [string, (c: View) => ReactNode][] = [
        [t("compare.speed"), (c) => <span className="font-mono">{text(c.column.lesson, "when")}</span>],
        [t("compare.starts"), (c) => t(c.column.polled ? "compare.receiver" : "compare.sender")],
        [t("compare.size"), (c) => <span className="font-mono">{bytesOf(c.fields)}</span>],
        [t("compare.time"), fact("time")],
        [t("role.quality"), fact("quality")],
        [t("role.cause"), fact("reason")],
        [t("compare.answer"), (c) => text(c.column.lesson, "answer")],
    ];
    const full = picked.length >= MAX_COMPARED;

    return (
        <main id="main" className="space-y-2 px-2 py-2 sm:px-3">
            <header className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("compare.title")}</h1>
                <p className="text-muted-foreground">{t("compare.lead")}</p>
            </header>

            <div role="group" aria-labelledby="compare-pick" className="flex flex-wrap items-center gap-2 text-sm">
                <span id="compare-pick" className="font-semibold">
                    {t("compare.pick")}
                </span>
                {COMPARED.map((id) => {
                    const meta = metaOf(id)!;
                    const on = picked.includes(id);
                    // A fifth cannot join until one leaves, and the last one stays
                    const locked = (!on && full) || (on && picked.length === 1);
                    return (
                        <button
                            key={id}
                            type="button"
                            aria-pressed={on}
                            disabled={locked}
                            title={!on && full ? t("compare.full") : undefined}
                            onClick={() => toggle(id)}
                            style={groupVars(meta.group)}
                            className={cn(
                                "flex min-h-8 items-center gap-1.5 rounded-sm border py-0.5 ps-0.5 pe-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                                on ? "border-[var(--g)] bg-[color-mix(in_oklab,var(--g)_12%,var(--card))] font-semibold" : "bg-card text-muted-foreground hover:border-[var(--g)] disabled:opacity-50",
                            )}
                        >
                            <GroupIcon group={meta.group} className="size-6" />
                            {meta.name}
                            {on && <Check className="size-3.5 text-[var(--g)]" aria-hidden="true" />}
                        </button>
                    );
                })}
                {full && <span className="text-xs text-muted-foreground">{t("compare.full")}</span>}
            </div>

            <Card className="gap-0 py-0">
                <ol className="grid grid-cols-1 divide-y lg:grid-cols-[repeat(var(--n),minmax(0,1fr))] lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse" style={{ "--n": timeline.length } as CSSProperties}>
                    {timeline.map((moment, i) => (
                        <li key={moment.what} className="px-3 py-2" style={moment.group ? groupVars(moment.group) : undefined}>
                            <p className={cn("font-mono text-xs", moment.group ? "text-[var(--g)]" : "text-[var(--viz-alert)]")}>
                                {i + 1} · {moment.at}
                            </p>
                            <p className="text-sm">{moment.what}</p>
                        </li>
                    ))}
                </ol>
            </Card>

            <div role="group" aria-labelledby="compare-lit" className="flex flex-wrap items-center gap-2 text-sm">
                <span id="compare-lit" className="text-muted-foreground">
                    {t("compare.highlight")}
                </span>
                {KEYS.map((role) => (
                    <button
                        key={role}
                        type="button"
                        aria-pressed={lit === role}
                        onClick={() => setLit(lit === role ? null : role)}
                        className={cn("flex min-h-8 items-center gap-2 rounded-sm border px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", lit === role ? "border-foreground font-semibold" : "bg-card hover:border-primary/60")}
                    >
                        <span aria-hidden="true" className="size-3 rounded-xs border border-foreground/20" style={{ background: roleColor(role) }} />
                        {t(`role.${role}` as MessageKey)}
                    </button>
                ))}
                {lit && (
                    <button type="button" onClick={() => setLit(null)} className="text-muted-foreground underline-offset-4 hover:underline">
                        {t("compare.all")}
                    </button>
                )}
            </div>

            {/* Side by side as far as the screen allows: three fit a wide one; four would leave one alone below, so two rows of two */}
            <div
                className="grid gap-2 md:grid-cols-[repeat(var(--md),minmax(0,1fr))] xl:grid-cols-[repeat(var(--xl),minmax(0,1fr))] 2xl:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
                style={{ "--md": Math.min(columns.length, 2), "--xl": columns.length === 3 ? 3 : Math.min(columns.length, 2), "--n": columns.length } as CSSProperties}
            >
                {columns.map(({ column, meta, fields }) => (
                    <Card key={column.lesson} className="gap-0 overflow-hidden py-0" style={groupVars(meta.group)} data-testid={`column-${column.lesson}`}>
                        <div className="h-1 bg-[var(--g)]" aria-hidden="true" />
                        <div className="space-y-1 border-b px-3 py-2">
                            <div className="flex items-center gap-2">
                                <GroupIcon group={meta.group} className="size-6" />
                                <h2 className="font-bold">
                                    <Link to={`/p/${meta.id}`} className="hover:text-primary">
                                        {meta.name}
                                    </Link>
                                </h2>
                                <span className="ms-auto rounded-sm bg-[color-mix(in_oklab,var(--g)_12%,transparent)] px-1.5 py-0.5 font-mono text-xs text-[var(--g)]">{text(column.lesson, "when")}</span>
                            </div>
                            <p className="text-sm">{text(column.lesson, "route")}</p>
                            <p className="text-xs text-muted-foreground">{text(column.lesson, "how")}</p>
                        </div>
                        <div className="space-y-2 px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                {t("frames.bytes", { count: bytesOf(fields) })} · {column.own ? t("compare.poll") : t("compare.from", { name: meta.name })}
                            </p>
                            <ol dir="ltr" className="flex flex-wrap gap-1">
                                {fields.map((field, i) => (
                                    <li
                                        key={i}
                                        title={`${field.label} · ${t(`role.${field.role}` as MessageKey)}`}
                                        className={cn("rounded-xs px-1.5 py-0.5 font-mono text-xs transition-opacity", lit && field.role !== lit && "opacity-20", lit === field.role && "ring-2 ring-foreground")}
                                        style={{ background: roleColor(field.role) }}
                                    >
                                        {field.hex}
                                    </li>
                                ))}
                            </ol>
                            <ul className="space-y-0.5 text-xs">
                                {fields
                                    .filter((field) => (lit ? field.role === lit : NEWS.includes(field.role)))
                                    .map((field, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span dir="ltr" className="shrink-0 rounded-xs px-1 font-mono" style={{ background: roleColor(field.role) }}>
                                                {field.hex.length > 11 ? `${field.hex.slice(0, 11)}…` : field.hex}
                                            </span>
                                            <span>{field.label}</span>
                                        </li>
                                    ))}
                                {lit && !fields.some((field) => field.role === lit) && <li className="text-muted-foreground">{t("compare.none")}</li>}
                            </ul>
                        </div>
                    </Card>
                ))}
            </div>

            {/* On a phone the table scrolls sideways: it can be focused, so the keys scroll it too */}
            <Card className="gap-0 overflow-x-auto py-0" tabIndex={0} role="region" aria-label={t("compare.title")}>
                <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                            <td className="px-3 py-2" />
                            {columns.map(({ meta }) => (
                                <th key={meta.id} scope="col" className="px-3 py-2 text-start font-semibold">
                                    {meta.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map(([label, cell]) => (
                            <tr key={label}>
                                <th scope="row" className="px-3 py-2 text-start font-medium text-muted-foreground">
                                    {label}
                                </th>
                                {columns.map((c) => (
                                    <td key={c.meta.id} className="px-3 py-2">
                                        {cell(c)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </main>
    );
}
