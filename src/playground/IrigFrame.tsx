import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Rich } from "@/glossary/Rich";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { GROUPS, irigFrame, isTime, pulseOf, type Group } from "./irig";

/** The colour of each part of the frame, from the byte inspector's colours. */
const COLOR: Record<Group, string> = {
    marker: "var(--field-frame)",
    seconds: "var(--field-time)",
    minutes: "var(--field-time)",
    hours: "var(--field-time)",
    day: "var(--field-time)",
    year: "var(--field-time)",
    control: "var(--field-control)",
    parity: "var(--field-quality)",
    sbs: "var(--field-value)",
    index: "var(--muted)",
};
const LEGEND = [
    ["marker", "irig.markers"],
    ["seconds", "irig.bcd"],
    ["control", "irig.control"],
    ["parity", "irig.parity"],
    ["sbs", "irig.sbs"],
] as const satisfies readonly (readonly [Group, string])[];

/** A time, day and year, and the 100 cells of the IRIG-B frame that sends them, drawn as their pulses. */
export function IrigFrame({ intro }: { intro: string }) {
    const { t } = useI18n();
    const id = useId();
    const [clock, setClock] = useState("10:41:07");
    const [dayText, setDayText] = useState("316");
    const [yearText, setYearText] = useState("26");
    const [hours, minutes, seconds] = clock.split(":").map(Number);
    const time = { hours: hours ?? NaN, minutes: minutes ?? NaN, seconds: seconds ?? NaN, day: Number(dayText), year: Number(yearText) };
    const valid = /^\d{1,2}:\d{2}:\d{2}$/.test(clock) && isTime(time);
    // The last valid frame stays on screen while the reader types
    const [shown, setShown] = useState(() => irigFrame(time));
    if (valid && irigFrame(time).join() !== shown.join()) setShown(irigFrame(time));

    const field = (key: string, label: MessageKey, value: string, set: (text: string) => void) => (
        <div className="space-y-1.5">
            <label htmlFor={id + key} className="text-xs font-semibold">
                {t(label)}
            </label>
            <Input id={id + key} dir="ltr" value={value} aria-invalid={!valid} onChange={(event) => set(event.target.value)} className="font-mono" />
        </div>
    );

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                <Rich text={intro} />
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
                {field("t", "irig.time", clock, setClock)}
                {field("d", "irig.day", dayText, setDayText)}
                {field("y", "irig.year", yearText, setYearText)}
            </div>
            <div className="space-y-1">
                <p className="text-xs font-semibold">{t("irig.cells")}</p>
                <ol dir="ltr" className="grid grid-cols-10 gap-px border bg-border" aria-label={t("irig.cells")}>
                    {shown.map((cell, bit) => (
                        <li key={bit} title={`${bit} · ${cell}`} className="relative h-7 bg-card">
                            <span className="absolute inset-y-1 start-0 border-e border-foreground/30" style={{ width: `${pulseOf(cell) * 10}%`, background: COLOR[GROUPS[bit]!] }} />
                            <span className="absolute end-0.5 bottom-0 font-mono text-[9px] text-muted-foreground">{bit}</span>
                        </li>
                    ))}
                </ol>
                <p className="text-xs text-muted-foreground">{t("irig.pulse")}</p>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {LEGEND.map(([group, label]) => (
                    <li key={group} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="size-3 border border-foreground/20" style={{ background: COLOR[group] }} />
                        {t(label as MessageKey)}
                    </li>
                ))}
            </ul>
        </div>
    );
}
