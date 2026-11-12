import type { Timing } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { useI18n } from "@/i18n/i18n";

const WIDTH = 880;
const LEFT = 150;
const RIGHT = 24;
const TRACK = 84;

/** When messages go out, or how a signal changes, along one time axis. */
export function TimingChart({ timing, words }: { timing: Timing; words: Words }) {
    const { number } = useI18n();
    const span = WIDTH - LEFT - RIGHT;
    const x = (t: number) => LEFT + (timing.scale === "log" ? (Math.log2(1 + t) / Math.log2(1 + timing.end)) * span : (t / timing.end) * span);
    const height = timing.tracks.length * TRACK + 34;
    return (
        <div dir="ltr" className="overflow-x-auto">
            <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block h-auto w-full min-w-[560px]" role="img" aria-label={timing.tracks.map((track) => words.timing(track.id)).join(", ")}>
                {timing.tracks.map((track, i) => {
                    const base = 14 + i * TRACK + TRACK - 14;
                    const y = (level: number) => base - level * (TRACK - 26);
                    const steps = track.signal ?? [];
                    const signal = steps.length
                        ? steps.reduce((d, [t, level], j) => (j ? `${d} L${x(t)},${y(steps[j - 1]![1])} L${x(t)},${y(level)}` : `M${x(t)},${y(level)}`), "") + ` L${x(timing.end)},${y(steps.at(-1)![1])}`
                        : null;
                    return (
                        <g key={track.id}>
                            <text x={LEFT - 12} y={base - 8} textAnchor="end" className="fill-foreground text-[12px] font-semibold">
                                {words.timing(track.id)}
                            </text>
                            <path d={`M${LEFT},${base} L${WIDTH - RIGHT},${base}`} stroke="var(--border)" strokeWidth={1.5} />
                            {signal && <path d={signal} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />}
                            {track.events?.map((event, j) => {
                                const tall = event.mark === "event" ? TRACK - 22 : event.mark === "repeat" ? TRACK - 32 : TRACK - 40;
                                const color = event.mark === "event" ? "var(--viz-token)" : event.mark === "repeat" ? "var(--primary)" : "var(--muted-foreground)";
                                return (
                                    <g key={j}>
                                        <rect x={x(event.t) - 3} y={base - tall} width={6} height={tall} rx={1.5} fill={color} />
                                        {event.label && (
                                            <text x={x(event.t) - 3} y={base - tall - 6} className="fill-muted-foreground text-[11px]">
                                                {words.timing(event.label)}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
                {timing.ticks.map((tick) => (
                    <text key={tick} x={x(tick)} y={height - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[10.5px]">
                        {number(tick, 3)}
                    </text>
                ))}
                <text x={LEFT - 12} y={height - 8} textAnchor="end" className="fill-muted-foreground font-mono text-[10.5px]">
                    {timing.unit}
                </text>
            </svg>
        </div>
    );
}
