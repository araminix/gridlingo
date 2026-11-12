import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n";
import type { Step } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { Rich } from "@/glossary/Rich";
import { cn } from "@/lib/utils";

/** The steps of a lesson as a row of buttons. */
export function StepStrip({ steps, current, onGo, words }: { steps: readonly Step[]; current: number; onGo: (index: number) => void; words: Words }) {
    const { number } = useI18n();
    return (
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
            {steps.map((step, index) => (
                <li key={step.id}>
                    <button
                        type="button"
                        onClick={() => onGo(index)}
                        aria-current={index === current ? "step" : undefined}
                        className={cn(
                            "flex h-full min-h-12 w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-start text-[13px] leading-tight font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            index === current
                                ? "border-primary bg-primary text-primary-foreground"
                                : index < current
                                  ? "border-primary/50 bg-accent text-accent-foreground"
                                  : "bg-card text-muted-foreground hover:bg-muted",
                        )}
                    >
                        <span className="font-mono text-xs">{number(index + 1)}</span>
                        <span>{words.step(step.id).title}</span>
                    </button>
                </li>
            ))}
        </ol>
    );
}

/** What happens in this step, in words, and the buttons to move through the lesson. */
export function StepCaption({
    steps,
    current,
    playing,
    onGo,
    onPlay,
    wire,
    words,
}: {
    steps: readonly Step[];
    current: number;
    playing: boolean;
    onGo: (index: number) => void;
    onPlay: () => void;
    wire: string | undefined;
    words: Words;
}) {
    const { t } = useI18n();
    const step = steps[current]!;
    const last = steps.length - 1;
    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-[1_1_20rem]" aria-live="polite">
                <p className="text-xs font-semibold text-primary">
                    {t("player.step", { n: current + 1, total: steps.length })} · {words.step(step.id).title}
                </p>
                <p className="mt-0.5 text-[15px]">
                    <Rich text={words.step(step.id).text} />
                </p>
                {wire && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        {t("player.wire")}{" "}
                        <span dir="ltr" className="font-mono text-foreground">
                            {wire}
                        </span>
                    </p>
                )}
            </div>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="icon" className="size-11" onClick={() => onGo(current - 1)} disabled={current === 0} aria-label={t("player.back")}>
                    <ChevronLeft className="rtl:rotate-180" />
                </Button>
                <Button className="h-11 min-w-28 px-5" onClick={onPlay}>
                    {playing ? <Pause /> : <Play />}
                    {playing ? t("player.pause") : t("player.play")}
                </Button>
                <Button variant="outline" size="icon" className="size-11" onClick={() => onGo(current + 1)} disabled={current === last} aria-label={t("player.next")}>
                    <ChevronRight className="rtl:rotate-180" />
                </Button>
                <Button variant="outline" size="icon" className="size-11" onClick={() => onGo(0)} aria-label={t("player.reset")}>
                    <RotateCcw />
                </Button>
            </div>
        </div>
    );
}
