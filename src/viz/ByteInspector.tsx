import { useState } from "react";
import type { Field, FieldRole, Frame } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { useI18n } from "@/i18n/i18n";
import { Rich } from "@/glossary/Rich";
import { cn } from "@/lib/utils";

export const ROLES: readonly FieldRole[] = ["frame", "control", "type", "size", "cause", "address", "value", "quality", "time", "security"];

/** The background of a field of this role (a CSS colour token of the theme). */
export const roleColor = (role: FieldRole) => `var(--field-${role})`;

/** The number of bytes in a run of hex pairs ("68 04 07"), or 0 when it is not hex. */
export const byteCount = (hex: string) => (/^([0-9A-F]{2})( [0-9A-F]{2})*$/.test(hex) ? hex.split(" ").length : 0);

export const sizeOf = (fields: readonly Field[]) => fields.reduce((sum, [hex]) => sum + byteCount(hex), 0);

/** A frame's size on the wire: as given, when its fields show only part of it, or the bytes of its fields. */
export const frameSize = (frame: Frame) => frame.size ?? sizeOf(frame.fields ?? []);

/** The bytes of a frame, coloured by what they carry, and what each run means. Hovering one shows its meaning. */
export function ByteInspector({ frame, words }: { frame: Frame; words: Words }) {
    const { t } = useI18n();
    const [hovered, setHovered] = useState<number | null>(null);
    const fields = frame.fields ?? [];

    if (!fields.length) {
        const note = words.note(frame.id);
        return (
            <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium">{words.frame(frame.id)}</p>
                {note && (
                    <p className="text-muted-foreground">
                        <Rich text={note} />
                    </p>
                )}
            </div>
        );
    }

    const roles = ROLES.filter((role) => fields.some(([, fieldRole]) => fieldRole === role));
    const note = words.note(frame.id);
    return (
        <div className="space-y-4">
            {note && (
                <p className="text-sm text-muted-foreground">
                    <Rich text={note} />
                </p>
            )}
            <ol dir="ltr" className="flex flex-wrap gap-1.5" aria-label={t("bytes.title")}>
                {fields.map(([hex, role, key], i) => (
                    <li
                        key={i}
                        onPointerEnter={() => setHovered(i)}
                        onPointerLeave={() => setHovered(null)}
                        className={cn("flex flex-col gap-1 rounded-md px-2 py-1.5 transition-shadow", hovered === i && "ring-2 ring-primary")}
                        style={{ background: roleColor(role) }}
                    >
                        <span className="font-mono text-[15px] font-semibold tracking-wide whitespace-pre-wrap">{hex}</span>
                        <span dir="auto" className="text-[11px] text-foreground/75">
                            {words.field(key).name}
                        </span>
                    </li>
                ))}
            </ol>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={t("bytes.legend")}>
                {roles.map((role) => (
                    <li key={role} className="flex items-center gap-1.5">
                        <span aria-hidden="true" className="size-3 rounded-sm border border-foreground/15" style={{ background: roleColor(role) }} />
                        {t(`role.${role}`)}
                    </li>
                ))}
            </ul>
            <dl className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
                {fields.map(([hex, role, key], i) => (
                    <div
                        key={i}
                        onPointerEnter={() => setHovered(i)}
                        onPointerLeave={() => setHovered(null)}
                        className={cn("flex items-start gap-3 border-b py-2 text-sm", hovered === i && "bg-accent/60")}
                    >
                        <dt dir="ltr" className="max-w-[45%] min-w-16 shrink-0 rounded-sm px-1.5 py-0.5 text-center font-mono text-xs font-semibold break-words" style={{ background: roleColor(role) }}>
                            {hex}
                        </dt>
                        <dd>
                            <span className="font-semibold">{words.field(key).name}.</span> <Rich text={words.field(key).note} />
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}
