import type { Frame } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { useI18n } from "@/i18n/i18n";
import { cn } from "@/lib/utils";
import { sizeOf } from "./ByteInspector";

/** The frames so far, like a capture in Wireshark: pick one to see its bytes. */
export function FrameList({ frames, selected, onSelect, words }: { frames: readonly Frame[]; selected: string | undefined; onSelect: (id: string) => void; words: Words }) {
    const { t, dir } = useI18n();
    const arrow = dir === "rtl" ? "←" : "→";
    const grid = "grid grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-x-3 md:grid-cols-[2rem_4rem_8.5rem_3.5rem_minmax(8rem,12rem)_minmax(12rem,1fr)_4.5rem]";
    return (
        <div>
            <div className={cn(grid, "border-b px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase")}>
                <span>{t("frames.no")}</span>
                <span className="hidden md:block">{t("frames.time")}</span>
                <span className="hidden md:block">{t("frames.route")}</span>
                <span className="hidden md:block">{t("frames.kind")}</span>
                <span className="hidden md:block">{t("frames.name")}</span>
                <span>{t("frames.says")}</span>
                <span className="text-end">{t("frames.size")}</span>
            </div>
            <ol>
                {frames.map((frame, index) => {
                    const on = frame.id === selected;
                    const size = sizeOf(frame.fields ?? []);
                    const targets = typeof frame.to === "string" ? [frame.to] : frame.to;
                    return (
                        <li key={frame.id}>
                            <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => onSelect(frame.id)}
                                className={cn(
                                    grid,
                                    "w-full border-b border-s-[3px] px-4 py-2.5 text-start text-sm outline-none focus-visible:bg-accent",
                                    on ? "border-s-primary bg-accent/70" : "border-s-transparent hover:bg-muted/60",
                                )}
                            >
                                <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
                                <span className="hidden font-mono text-xs md:block">{frame.time ?? ""}</span>
                                <span className="hidden truncate text-xs md:block">
                                    {words.device(frame.from)} {arrow} {targets.map((target) => words.device(target)).join(", ")}
                                </span>
                                <span className="hidden font-mono text-xs font-bold md:block">{frame.kind}</span>
                                <span dir="ltr" className="hidden truncate text-left font-mono text-xs md:block rtl:text-right">
                                    {frame.name}
                                </span>
                                <span className="min-w-0">
                                    <span dir="ltr" className="block truncate text-left font-mono text-xs font-semibold md:hidden rtl:text-right">
                                        {frame.name}
                                    </span>
                                    <span className="block">{words.frame(frame.id)}</span>
                                </span>
                                <span className="text-end font-mono text-xs text-muted-foreground">{size ? t("frames.bytes", { count: size }) : "–"}</span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
