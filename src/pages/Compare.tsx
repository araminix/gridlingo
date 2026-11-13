import { Check, Minus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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

// PROTOTYPE, English only: one event, told by four protocols side by side. Three frames come from their lessons (their
// bytes are proven there); Modbus has no event to send, so its column is the poll that would find the breaker open.

interface Column {
    lesson: string;
    frame: string | null;
    /** Bytes given here when the lesson has no such frame, each with its label. */
    own?: readonly (readonly [...Field, string])[];
    route: string;
    how: string;
    when: string;
    answer: string;
    /** What the frame says about when, how sure and why; null when it cannot say it at all. */
    facts: { time: string | null; quality: string | null; reason: string | null };
}

const COLUMNS: readonly Column[] = [
    { lesson: "iec-61850-goose", frame: "event", route: "Relay F1 → every relay and the breaker on the bus", how: "Published at once, then repeated faster and faster", when: "≈ 3 ms", answer: "None: it repeats instead", facts: { time: "t: 8 bytes, when the state last changed", quality: "q: per value, inside the data", reason: null } },
    { lesson: "iec-104", frame: "trip", route: "RTU → SCADA", how: "Sent by itself when the breaker moves (cause 3, spontaneous)", when: "≈ 0.1 – 1 s", answer: "S-frame, after up to 8 frames", facts: { time: "CP56Time2a: 7 bytes, to the millisecond", quality: "In the state byte: IV, NT, SB, BL bits", reason: "Cause 3: spontaneous" } },
    { lesson: "dnp3", frame: "unsolicited", route: "RTU (outstation) → SCADA (master)", how: "Unsolicited response, once enabled", when: "≈ 0.1 – 1 s", answer: "Application confirm, at once", facts: { time: "6 bytes: milliseconds since 1970", quality: "A flags byte per point: online, comm lost…", reason: null } },
    {
        lesson: "modbus-tcp",
        frame: null,
        own: [
            ["00 05", "control", "tid", "Transaction 5"],
            ["00 00", "control", "pid", "Protocol 0: Modbus"],
            ["00 04", "size", "length", "4 bytes follow"],
            ["01", "address", "unit", "Unit 1"],
            ["02", "type", "fc", "FC 02: read discrete inputs"],
            ["01", "size", "count", "1 byte of inputs"],
            ["00", "value", "status", "Input 0 = 0: open"],
        ],
        route: "SCADA asks, the controller answers",
        how: "Polled: nothing moves until someone asks",
        when: "Up to one poll later (often 1 – 5 s)",
        answer: "This frame is the answer",
        facts: { time: null, quality: null, reason: null },
    },
];

/** The meanings a reader can light up across all four frames at once. */
const KEYS: readonly FieldRole[] = ["value", "time", "quality", "cause", "address"];

const TIMELINE = [
    { at: "0 ms", what: "A fault on feeder F1" },
    { at: "≈ 3 ms", what: "GOOSE: relay F1 announces the trip" },
    { at: "≈ 60 ms", what: "Breaker Q1 is open" },
    { at: "≈ 0.1 – 1 s", what: "IEC 104 and DNP3 tell the control room" },
    { at: "next poll", what: "Modbus finds out when it asks" },
];

export function Compare() {
    const { t, lang } = useI18n();
    const [loaded, setLoaded] = useState<Record<string, Loaded | null>>({});
    const [lit, setLit] = useState<FieldRole | null>(null);
    useEffect(() => {
        let current = true;
        void Promise.all(COLUMNS.map((column) => loadLesson(column.lesson, lang).then((result) => [column.lesson, result] as const))).then(
            (list) => current && setLoaded(Object.fromEntries(list)),
        );
        return () => {
            current = false;
        };
    }, [lang]);

    // Each column's bytes with their labels, from its lesson or given above
    const columns = COLUMNS.map((column) => {
        const data = loaded[column.lesson];
        const meta = metaOf(column.lesson)!;
        if (column.own) return { column, meta, fields: column.own.map(([hex, role, , label]) => ({ hex, role, label })) };
        if (!data) return { column, meta, fields: [] };
        const words = wordsOf(data.text, data.english);
        const frame = data.lesson.frames.find((item) => item.id === column.frame)!;
        return { column, meta, fields: (frame.fields ?? []).map(([hex, role, key]) => ({ hex, role, label: words.field(key).name })) };
    });
    const bytesOf = (fields: { hex: string; role: FieldRole }[], role?: FieldRole) => fields.filter((field) => !role || field.role === role).reduce((sum, field) => sum + byteCount(field.hex), 0);

    // The table's rows: what each protocol does, and which meanings its bytes carry
    type View = (typeof columns)[number];
    const rows: [string, (c: View) => ReactNode][] = [
        ["How fast", (c) => <span className="font-mono">{c.column.when}</span>],
        ["Who starts it", (c) => (c.column.own ? "The receiver, by asking" : "The sender, when it changes")],
        ["Bytes on the wire", (c) => <span className="font-mono">{bytesOf(c.fields)}</span>],
        ...(
            [
                ["time", "Time stamp"],
                ["quality", "Quality"],
                ["reason", "Reason"],
            ] as const
        ).map(([key, label]): [string, (c: View) => ReactNode] => [
            label,
            (c) => {
                const fact = c.column.facts[key];
                return fact ? (
                    <span className="flex items-start gap-1.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-[var(--viz-ok)]" aria-label="yes" /> {fact}
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Minus className="size-4" aria-label="no" /> Not carried
                    </span>
                );
            },
        ]),
        ["The receiver answers", (c) => c.column.answer],
    ];

    return (
        <main id="main" className="space-y-2 px-2 py-2 sm:px-3">
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">One event, four protocols</h1>
                <p className="text-muted-foreground">A fault on feeder F1: the relay trips, breaker Q1 opens. Who tells whom, how fast, and in which bytes.</p>
            </header>

            <Card className="gap-0 py-0">
                <ol className="grid grid-cols-1 divide-y sm:grid-cols-5 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
                    {TIMELINE.map((moment, i) => (
                        <li key={moment.at} className="px-3 py-2">
                            <p className="font-mono text-xs text-primary">
                                {i + 1} · {moment.at}
                            </p>
                            <p className="text-sm">{moment.what}</p>
                        </li>
                    ))}
                </ol>
            </Card>

            <div role="group" aria-label="Highlight a meaning in every frame" className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Highlight:</span>
                {KEYS.map((role) => (
                    <button
                        key={role}
                        type="button"
                        aria-pressed={lit === role}
                        onClick={() => setLit(lit === role ? null : role)}
                        onMouseEnter={() => setLit(role)}
                        className={cn("flex min-h-8 items-center gap-2 rounded-sm border px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring", lit === role ? "border-foreground font-semibold" : "bg-card hover:border-primary/60")}
                    >
                        <span aria-hidden="true" className="size-3 rounded-xs border border-foreground/20" style={{ background: roleColor(role) }} />
                        {t(`role.${role}` as MessageKey)}
                    </button>
                ))}
                {lit && (
                    <button type="button" onClick={() => setLit(null)} className="text-muted-foreground underline-offset-4 hover:underline">
                        Show all
                    </button>
                )}
            </div>

            <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">
                {columns.map(({ column, meta, fields }) => (
                    <Card key={column.lesson} className="gap-0 overflow-hidden py-0" style={groupVars(meta.group)}>
                        <div className="h-1 bg-[var(--g)]" aria-hidden="true" />
                        <div className="space-y-1 border-b px-3 py-2">
                            <div className="flex items-center gap-2">
                                <GroupIcon group={meta.group} className="size-6" />
                                <Link to={`/p/${meta.id}`} className="font-bold hover:text-primary">
                                    {meta.name}
                                </Link>
                                <span className="ms-auto rounded-sm bg-[color-mix(in_oklab,var(--g)_12%,transparent)] px-1.5 py-0.5 font-mono text-xs text-[var(--g)]">{column.when}</span>
                            </div>
                            <p className="text-sm">{column.route}</p>
                            <p className="text-xs text-muted-foreground">{column.how}</p>
                        </div>
                        <div className="space-y-2 px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                {bytesOf(fields)} bytes{column.own ? " · the poll's answer" : ` · from the ${meta.name} lesson`}
                            </p>
                            <ol dir="ltr" className="flex flex-wrap gap-1">
                                {fields.map((field, i) => (
                                    <li
                                        key={i}
                                        title={`${field.label} · ${t(`role.${field.role}` as MessageKey)}`}
                                        className={cn(
                                            "rounded-xs px-1.5 py-0.5 font-mono text-xs transition-opacity",
                                            lit && field.role !== lit && "opacity-20",
                                            lit === field.role && "ring-2 ring-foreground",
                                        )}
                                        style={{ background: roleColor(field.role) }}
                                    >
                                        {field.hex}
                                    </li>
                                ))}
                            </ol>
                            <ul className="space-y-0.5 text-xs">
                                {fields
                                    .filter((field) => !lit || field.role === lit)
                                    .filter((field) => lit || (["value", "time", "quality", "cause"] as FieldRole[]).includes(field.role))
                                    .map((field, i) => (
                                        <li key={i} className="flex gap-2">
                                            <span dir="ltr" className="shrink-0 rounded-xs px-1 font-mono" style={{ background: roleColor(field.role) }}>
                                                {field.hex.length > 11 ? `${field.hex.slice(0, 11)}…` : field.hex}
                                            </span>
                                            <span>{field.label}</span>
                                        </li>
                                    ))}
                                {lit && !fields.some((field) => field.role === lit) && <li className="text-muted-foreground">No {t(`role.${lit}` as MessageKey).toLowerCase()} in this frame.</li>}
                            </ul>
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="gap-0 overflow-x-auto py-0">
                <table className="w-full min-w-[40rem] text-sm">
                    <thead>
                        <tr className="border-b text-start text-xs text-muted-foreground uppercase">
                            <th className="px-3 py-2 text-start font-semibold"> </th>
                            {columns.map(({ meta }) => (
                                <th key={meta.id} className="px-3 py-2 text-start font-semibold">
                                    {meta.name}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {rows.map(([label, cell]) => (
                            <tr key={label}>
                                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{label}</th>
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
