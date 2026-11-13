import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Group } from "@/lessons/types";

/** The open lesson's name and group, shown in the header beside the logo instead of a title row on the page. */
interface PageTitle {
    name: string;
    group: Group;
}

const Context = createContext<{ title: PageTitle | null; setTitle: (title: PageTitle | null) => void } | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
    const [title, setTitle] = useState<PageTitle | null>(null);
    const value = useMemo(() => ({ title, setTitle }), [title]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The title the header shows, if a page gave one. */
export const usePageTitle = () => useContext(Context)?.title ?? null;

/** Gives the header this page's title while the page is open. */
export function useSetPageTitle(name: string, group: Group) {
    const setTitle = useContext(Context)?.setTitle;
    useEffect(() => {
        setTitle?.({ name, group });
        return () => setTitle?.(null);
    }, [setTitle, name, group]);
}
