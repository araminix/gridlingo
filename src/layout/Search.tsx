import { Search as SearchIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useI18n, type MessageKey } from "@/i18n/i18n";
import { CATALOG, GROUPS } from "@/lessons/catalog";
import type { Meta } from "@/lessons/types";
import { navigate } from "@/router";

// One search for the whole site: every button opens the same dialog
const listeners = new Set<() => void>();
let open = false;
const setOpen = (value: boolean) => {
    open = value;
    for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** A button that opens the search: compact for the header, wide for the home page. */
export function SearchButton({ wide = false }: { wide?: boolean }) {
    const { t } = useI18n();
    return wide ? (
        <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-12 w-full max-w-xl items-center gap-3 rounded-xl border bg-card px-4 text-start text-muted-foreground outline-none hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
        >
            <SearchIcon className="size-4.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{t("search.placeholder")}</span>
            <Kbd className="max-sm:hidden">Ctrl K</Kbd>
        </button>
    ) : (
        <Button variant="outline" onClick={() => setOpen(true)} aria-label={t("search.label")} className="h-9 justify-start gap-2 px-3 text-muted-foreground sm:w-64">
            <SearchIcon />
            <span className="flex-1 text-start max-sm:sr-only">{t("search.label")}</span>
            <Kbd className="max-sm:hidden">Ctrl K</Kbd>
        </Button>
    );
}

/**
 * The search dialog, once per page: finds a protocol by its name, its port, the devices it is met on or what it does.
 * Ctrl K or ⌘ K opens it, and "/" when no field has the focus.
 */
/** The words a protocol is found by, in the reader's language: its name, how it travels, its summary, its devices. */
export function wordsOf(meta: Meta, t: ReturnType<typeof useI18n>["t"]): string[] {
    return [meta.name, meta.wire, t(`lesson.${meta.id}.summary` as MessageKey), ...meta.devices.map((device) => t(`device.${device}` as MessageKey))];
}

export function SearchDialog() {
    const { t } = useI18n();
    const isOpen = useSyncExternalStore(subscribe, () => open, () => false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
            if ((event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) || (event.key === "/" && !typing)) {
                event.preventDefault();
                setOpen(true);
            }
        };
        addEventListener("keydown", onKey);
        return () => removeEventListener("keydown", onKey);
    }, []);

    return (
        <CommandDialog open={isOpen} onOpenChange={setOpen} title={t("search.label")} description={t("search.placeholder")}>
            <CommandInput placeholder={t("search.placeholder")} />
            <CommandList>
                <CommandEmpty>{t("search.empty")}</CommandEmpty>
                {GROUPS.map((group) => (
                    <CommandGroup key={group} heading={t(`group.${group}` as MessageKey)}>
                        {CATALOG.filter((meta) => meta.group === group).map((meta) => (
                            <CommandItem
                                key={meta.id}
                                value={meta.id}
                                keywords={wordsOf(meta, t)}
                                onSelect={() => {
                                    setOpen(false);
                                    navigate(`/p/${meta.id}`);
                                }}
                                className="flex-col items-start gap-0.5"
                            >
                                <span className="font-semibold">{meta.name}</span>
                                <span className="text-xs text-muted-foreground">{t(`lesson.${meta.id}.summary` as MessageKey)}</span>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                ))}
            </CommandList>
        </CommandDialog>
    );
}
