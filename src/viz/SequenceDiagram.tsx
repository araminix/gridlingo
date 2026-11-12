import type { Frame } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { cn } from "@/lib/utils";

/**
 * Who sends what to whom, in order: one column per device, one row per frame. A multicast reaches several columns.
 * Drawn left to right in every language, like the site.
 */
export function SequenceDiagram({
    actors,
    frames,
    selected,
    onSelect,
    words,
}: {
    actors: readonly string[];
    frames: readonly Frame[];
    selected: string | undefined;
    onSelect: (id: string) => void;
    words: Words;
}) {
    const n = actors.length;
    const centre = (id: string) => ((actors.indexOf(id) + 0.5) / n) * 100;
    return (
        <div dir="ltr" className="relative px-2 pb-3">
            <div className="sticky top-0 z-10 grid gap-2 bg-[var(--viz-ground)] py-3" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
                {actors.map((id) => (
                    <div key={id} dir="auto" className="rounded-lg border border-primary/40 bg-accent px-2 py-2 text-center text-sm font-semibold text-accent-foreground">
                        {words.device(id)}
                    </div>
                ))}
            </div>
            <div className="relative">
                {actors.map((id) => (
                    <div key={id} aria-hidden="true" className="absolute top-0 bottom-0 w-px bg-border" style={{ left: `${centre(id)}%` }} />
                ))}
                <ol className="relative">
                    {frames.map((frame) => {
                        const targets = typeof frame.to === "string" ? [frame.to] : [...frame.to];
                        const columns = [frame.from, ...targets].map(centre);
                        const [start, end] = [Math.min(...columns), Math.max(...columns)];
                        const on = frame.id === selected;
                        return (
                            <li key={frame.id}>
                                <button
                                    type="button"
                                    onClick={() => onSelect(frame.id)}
                                    aria-pressed={on}
                                    className={cn(
                                        "relative block h-14 w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        on ? "bg-accent/70" : "hover:bg-muted/60",
                                    )}
                                >
                                    <span
                                        dir="auto"
                                        className={cn("absolute top-1.5 truncate px-1 text-center font-mono text-xs", on ? "font-semibold text-primary" : "text-foreground")}
                                        style={{ left: `${start}%`, width: `${Math.max(end - start, 100 / n)}%`, ...(end === start ? { left: `${start - 50 / n}%` } : {}) }}
                                    >
                                        {frame.name}
                                    </span>
                                    <span aria-hidden="true" className={cn("absolute top-8 h-0.5", on ? "bg-primary" : "bg-muted-foreground/70")} style={{ left: `${start}%`, width: `${end - start}%` }} />
                                    {targets.map((target) => {
                                        const at = centre(target);
                                        const right = at >= centre(frame.from);
                                        return (
                                            <span
                                                key={target}
                                                aria-hidden="true"
                                                className={cn("absolute top-[27px] size-0 border-y-[6px] border-y-transparent", on ? "border-primary" : "border-muted-foreground/70", right ? "border-l-[9px]" : "border-r-[9px]")}
                                                style={{ left: `calc(${at}% - ${right ? 9 : 0}px)`, borderTopColor: "transparent", borderBottomColor: "transparent" }}
                                            />
                                        );
                                    })}
                                    <span className="sr-only">
                                        {words.device(frame.from)} → {targets.map((target) => words.device(target)).join(", ")}: {words.frame(frame.id)}
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
