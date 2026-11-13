import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Rich } from "@/glossary/Rich";
import { useI18n } from "@/i18n/i18n";
import { cn } from "@/lib/utils";
import { dutyFor, readingOf, rowOf, RULE } from "./pilot";

/** A duty cycle and the current it offers, both ways, its 1 kHz wave, and the rule with the row in use lit. */
export function PilotDuty({ duty: start, intro }: { duty: number; intro: string }) {
    const { t } = useI18n();
    const id = useId();
    const [dutyText, setDutyText] = useState(String(start));
    const [ampsText, setAmpsText] = useState(() => {
        const reading = readingOf(start);
        return reading.kind === "current" ? String(reading.amps) : "";
    });
    const duty = Number(dutyText.replace(",", "."));
    const reading = readingOf(duty);

    const fromDuty = (text: string) => {
        setDutyText(text);
        const next = readingOf(Number(text.replace(",", ".")));
        setAmpsText(next.kind === "current" ? String(next.amps) : "");
    };
    const fromAmps = (text: string) => {
        setAmpsText(text);
        const next = dutyFor(Number(text.replace(",", ".")));
        if (next !== null) setDutyText(String(next));
    };

    // Three periods of the 1 kHz wave: high for the duty cycle's share of each millisecond, then low
    const share = Number.isFinite(duty) ? Math.min(100, Math.max(0, duty)) / 100 : 0;
    const wave = [0, 1, 2].map((ms) => `M${ms * 100},44 V8 H${ms * 100 + share * 100} V44 H${(ms + 1) * 100}`).join(" ");

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                <Rich text={intro} />
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor={`${id}d`} className="text-xs font-semibold">
                        {t("pilot.duty")}
                    </label>
                    <Input id={`${id}d`} dir="ltr" inputMode="decimal" value={dutyText} onChange={(event) => fromDuty(event.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor={`${id}a`} className="text-xs font-semibold">
                        {t("pilot.current")}
                    </label>
                    <Input id={`${id}a`} dir="ltr" inputMode="decimal" value={ampsText} aria-invalid={ampsText !== "" && dutyFor(Number(ampsText.replace(",", "."))) === null} onChange={(event) => fromAmps(event.target.value)} className="font-mono" />
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border bg-muted/40 px-3 py-2" aria-live="polite">
                <span className="text-xs font-semibold text-muted-foreground">{t("pilot.reads")}</span>
                <span className="font-semibold">{reading.kind === "current" ? t("pilot.max", { amps: reading.amps }) : reading.kind === "digital" ? t("pilot.digital") : t("pilot.none")}</span>
                <svg viewBox="0 0 300 52" className="ms-auto h-10 w-48 text-primary" aria-hidden="true">
                    <path d="M0,26 H300" className="stroke-border" strokeDasharray="3 3" />
                    <path d={wave} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
                </svg>
            </div>
            <table className="w-full text-sm">
                <caption className="pb-1 text-start text-xs font-semibold">{t("pilot.rule")}</caption>
                <tbody className="divide-y border-y">
                    {RULE.map((row, i) => (
                        <tr key={row.range} className={cn(Number.isFinite(duty) && rowOf(duty) === i && "bg-[color-mix(in_oklab,var(--primary)_10%,transparent)] font-semibold")}>
                            <td dir="ltr" className="px-2 py-1 text-start font-mono whitespace-nowrap rtl:text-end">
                                {row.range} %
                            </td>
                            <td className="px-2 py-1">{row.reading === "none" ? t("pilot.none") : row.reading === "digital" ? t("pilot.digital") : <span dir="ltr">{row.reading}</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
