import { useState } from "react";
import { useI18n } from "@/i18n/i18n";
import { Rich } from "@/glossary/Rich";
import { cn } from "@/lib/utils";

/** A sample file with its important lines marked: pick one to read what it means. */
export function SampleFile({ name, file, notes, intro, noteText }: { name: string; file: string; notes: Readonly<Record<number, string>>; intro: string; noteText: (key: string) => string }) {
    const { t } = useI18n();
    const marked = Object.keys(notes).map(Number);
    const [line, setLine] = useState<number>(marked[0] ?? 1);
    const lines = file.replace(/\n$/, "").split("\n");
    const note = notes[line];
    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                <Rich text={intro} />
            </p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <figure className="min-w-0 overflow-hidden rounded-lg border">
                    <figcaption className="border-b bg-muted px-3 py-1.5 font-mono text-xs">{name}</figcaption>
                    <ol dir="ltr" className="max-h-96 overflow-auto bg-[var(--viz-screen)] py-2 font-mono text-[12.5px] leading-6 text-slate-200">
                        {lines.map((text, i) => {
                            const number = i + 1;
                            const hasNote = notes[number] !== undefined;
                            return (
                                <li key={number} className={cn("flex", number === line && hasNote && "bg-primary/35")}>
                                    <span className="w-10 shrink-0 pe-3 text-end text-slate-500 select-none">{number}</span>
                                    {hasNote ? (
                                        <button type="button" onClick={() => setLine(number)} aria-pressed={number === line} className="min-w-0 flex-1 text-start whitespace-pre underline decoration-amber-400/70 decoration-dotted underline-offset-4 outline-none focus-visible:bg-primary/40">
                                            {text}
                                        </button>
                                    ) : (
                                        <span className="min-w-0 flex-1 whitespace-pre">{text}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </figure>
                <div className="rounded-lg border bg-card p-3 text-sm" aria-live="polite">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("playground.line", { n: line })}</p>
                    <p>{note ? <Rich text={noteText(note)} /> : t("playground.pick")}</p>
                </div>
            </div>
        </div>
    );
}
