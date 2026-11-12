import { ChevronRight, FileUp, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { Rich } from "@/glossary/Rich";
import { cn } from "@/lib/utils";
import { filterTree, parseScl, type SclNode } from "./scl";

/** The largest file the explorer reads: bigger station files are rare, and would hold the page for long. */
const MAX_BYTES = 20 * 1024 * 1024;

/** An SCL file as a tree: the sample, or a file the reader opens (read here, never uploaded). */
export function SclExplorer({ sample, file, intro }: { sample: string; file: string; intro: string }) {
    const { t } = useI18n();
    const [source, setSource] = useState({ name: sample, text: file });
    const [problem, setProblem] = useState<MessageKey | null>(null);
    const [query, setQuery] = useState("");
    const picker = useRef<HTMLInputElement>(null);

    const result = useMemo(() => parseScl(source.text), [source]);
    const shown = result.ok ? filterTree(result.ieds, query) : [];

    const open = async (event: ChangeEvent<HTMLInputElement>) => {
        const chosen = event.target.files?.[0];
        event.target.value = "";
        if (!chosen) return;
        if (chosen.size > MAX_BYTES) return setProblem("scl.tooBig");
        const text = await chosen.text();
        const parsed = parseScl(text);
        if (!parsed.ok) return setProblem(parsed.error === "xml" ? "scl.notXml" : "scl.notScl");
        setProblem(null);
        setSource({ name: chosen.name, text });
    };

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                <Rich text={intro} />
            </p>
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                    {source.name}
                </Badge>
                <div className="ms-auto flex flex-wrap gap-2">
                    {source.name !== sample && (
                        <Button variant="outline" size="sm" onClick={() => setSource({ name: sample, text: file })}>
                            <RotateCcw />
                            {t("playground.sample")}
                        </Button>
                    )}
                    <Button size="sm" onClick={() => picker.current?.click()}>
                        <FileUp />
                        {t("playground.open")}
                    </Button>
                    <input ref={picker} type="file" accept=".icd,.cid,.scd,.ssd,.iid,.sed,.xml" className="hidden" onChange={open} aria-label={t("playground.open")} />
                </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("playground.local")}</p>
            {problem && (
                <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {t(problem)}
                </p>
            )}
            <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("scl.search")} aria-label={t("scl.search")} />
            <div dir="ltr" className="max-h-[28rem] overflow-auto rounded-lg border bg-card p-2">
                {shown.length ? (
                    <ul role="tree" aria-label={source.name}>
                        {shown.map((node, i) => (
                            <TreeNode key={`${node.name}${i}${query ? "?" : ""}`} node={node} depth={0} searching={!!query} />
                        ))}
                    </ul>
                ) : (
                    <p className="p-3 text-sm text-muted-foreground">{t("scl.empty")}</p>
                )}
            </div>
        </div>
    );
}

/** Devices, access points and logical devices start open; logical nodes and below open on a click, or all of them while searching. */
function TreeNode({ node, depth, searching }: { node: SclNode; depth: number; searching: boolean }) {
    const { t } = useI18n();
    const [open, setOpen] = useState(searching || node.kind === "IED" || node.kind === "AP" || node.kind === "LD");
    const meaning = node.lnClass ? t(`ln.${node.lnClass}` as MessageKey) : "";
    const known = node.lnClass && meaning !== `ln.${node.lnClass}`;
    const row = (
        <>
            <span className={cn("w-7 shrink-0 text-[10px] font-bold tracking-wide text-muted-foreground")}>{node.kind}</span>
            <span className="font-mono text-[13px] font-medium">{node.name}</span>
            {node.fc && <span className="rounded bg-muted px-1 font-mono text-[10px]">{node.fc}</span>}
            <span dir="auto" className="min-w-0 truncate text-xs text-muted-foreground">
                {known ? meaning : node.detail}
            </span>
            {node.value !== undefined && <span className="ms-auto shrink-0 font-mono text-[13px] font-semibold text-[var(--viz-alert)]">{node.value}</span>}
        </>
    );
    return (
        <li role="treeitem" aria-expanded={node.children.length ? open : undefined} aria-selected={false}>
            {node.children.length ? (
                <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 rounded px-1 py-1 text-start hover:bg-muted" style={{ paddingLeft: depth * 16 + 4 }}>
                    <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
                    {row}
                </button>
            ) : (
                <div className="flex items-center gap-2 px-1 py-1" style={{ paddingLeft: depth * 16 + 22 }}>
                    {row}
                </div>
            )}
            {open && node.children.length > 0 && (
                <ul role="group">
                    {node.children.map((child, i) => (
                        <TreeNode key={`${child.name}${i}`} node={child} depth={depth + 1} searching={searching} />
                    ))}
                </ul>
            )}
        </li>
    );
}
