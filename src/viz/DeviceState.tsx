import type { Points, Step } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { useI18n } from "@/i18n/i18n";

/** The values a row holds at a step: the last entry whose step is not later than it. */
export function valuesAt(row: Points["rows"][number], steps: readonly Step[], current: number) {
    const order = (id: string) => steps.findIndex((step) => step.id === id);
    let found = row.values[0]!;
    for (const entry of row.values) if (order(entry[0]) <= current) found = entry;
    return { inDevice: found[1], inReceiver: found[2] };
}

/** What the device holds, next to what the receiver knows so far. */
export function DeviceState({ points, steps, current, words }: { points: Points; steps: readonly Step[]; current: number; words: Words }) {
    const { t } = useI18n();
    return (
        <table className="w-full text-sm [overflow-wrap:anywhere]">
            <thead>
                <tr className="border-b text-start text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <th className="py-2 pe-2 text-start font-semibold">{t("points.address")}</th>
                    <th className="py-2 pe-2 text-start font-semibold">{t("points.signal")}</th>
                    <th className="py-2 pe-2 text-start font-semibold">{words.device(points.device)}</th>
                    <th className="py-2 text-start font-semibold">{words.device(points.receiver)}</th>
                </tr>
            </thead>
            <tbody>
                {points.rows.map((row) => {
                    const { inDevice, inReceiver } = valuesAt(row, steps, current);
                    return (
                        <tr key={row.id} className="border-b last:border-0">
                            <td dir="ltr" className="py-2 pe-2 text-left font-mono text-xs rtl:text-right">
                                {row.address}
                            </td>
                            <td className="py-2 pe-2">{words.point(row.id)}</td>
                            <td dir="auto" className="py-2 pe-2 text-left font-mono text-xs rtl:text-right">
                                {words.value(inDevice)}
                            </td>
                            <td dir="auto" className="py-2 text-left font-mono text-xs font-bold text-primary rtl:text-right">
                                {words.value(inReceiver)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
