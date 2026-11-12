import type { Anatomy } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { roleColor } from "./ByteInspector";

/** A name or an address taken apart, piece by piece, with what each piece means. */
export function NameAnatomy({ anatomy, words }: { anatomy: Anatomy; words: Words }) {
    return (
        <figure className="space-y-3">
            <figcaption className="text-sm font-semibold">{words.anatomy(anatomy.id)}</figcaption>
            <ol dir="ltr" className="flex flex-wrap gap-1.5">
                {anatomy.parts.map(([text, role, key], i) => (
                    <li key={i} className="flex max-w-56 min-w-24 flex-col gap-1 rounded-lg px-3 py-2" style={{ background: roleColor(role) }}>
                        <span className="font-mono text-base font-semibold break-all">{text}</span>
                        <span dir="auto" className="text-[11px] font-bold tracking-wide uppercase">
                            {words.field(key).name}
                        </span>
                        <span dir="auto" className="text-xs text-foreground/80">
                            {words.field(key).note}
                        </span>
                    </li>
                ))}
            </ol>
            {anatomy.also && (
                <p dir="ltr" className="font-mono text-sm break-all text-muted-foreground">
                    {anatomy.also}
                </p>
            )}
        </figure>
    );
}
