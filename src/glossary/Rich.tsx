import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { termPattern, type Entry, type Glossary } from "./glossary";

const GlossaryContext = createContext<{ glossary: Glossary; pattern: RegExp | null }>({ glossary: {}, pattern: null });

export function GlossaryProvider({ glossary, children }: { glossary: Glossary; children: ReactNode }) {
    const value = useMemo(() => ({ glossary, pattern: termPattern(glossary) }), [glossary]);
    return <GlossaryContext.Provider value={value}>{children}</GlossaryContext.Provider>;
}

/** A term with a dotted underline: a tap or a click shows its full name and what it means. */
function Term({ term, entry }: { term: string; entry: Entry }) {
    return (
        <Popover>
            <PopoverTrigger className="cursor-help rounded-sm underline decoration-primary/50 decoration-dotted decoration-[1.5px] underline-offset-[3px] outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring">
                {term}
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-1 text-sm">
                <p dir="auto">
                    <span dir="ltr" className="font-mono font-bold text-primary">
                        {term}
                    </span>{" "}
                    <span className="font-semibold">{entry.full}</span>
                </p>
                <p className="text-muted-foreground">{entry.plain}</p>
            </PopoverContent>
        </Popover>
    );
}

const HEX_PAIR = /^[0-9A-F]{2}$/;
/** Bodies whose name starts a standard's number: "IEC 61850" is a name to read whole, not a term to explain. */
const BODIES = new Set(["IEC", "ISO", "IEEE", "IETF", "RFC", "ANSI", "TIA", "EN", "CiA", "NIST", "FIPS"]);
/** Whether a two-letter term ("CF", "AC") sits in a run of hex bytes, where it is a byte, not the term. */
function insideBytes(text: string, at: number, term: string) {
    if (!HEX_PAIR.test(term)) return false;
    return /(^|\s)[0-9A-F]{2} $/.test(text.slice(Math.max(0, at - 4), at)) || /^ [0-9A-F]{2}(\s|$)/.test(text.slice(at + 2, at + 6));
}

/** A text with the glossary's terms marked: each term once, where it first appears. */
export function Rich({ text }: { text: string }) {
    const { glossary, pattern } = useContext(GlossaryContext);
    if (!pattern || !text) return <>{text}</>;
    const parts: ReactNode[] = [];
    const seen = new Set<string>();
    let last = 0;
    for (const match of text.matchAll(pattern)) {
        const term = match[0];
        if (seen.has(term) || insideBytes(text, match.index, term) || (BODIES.has(term) && /^[ -]?\d/.test(text.slice(match.index + term.length)))) continue;
        seen.add(term);
        parts.push(text.slice(last, match.index), <Term key={match.index} term={term} entry={glossary[term]!} />);
        last = match.index + term.length;
    }
    parts.push(text.slice(last));
    return <>{parts}</>;
}
