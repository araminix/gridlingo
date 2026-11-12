import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

/** The site's address without a trailing slash: "" locally, "/gridlingo" on GitHub Pages. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    addEventListener("popstate", listener);
    return () => {
        listeners.delete(listener);
        removeEventListener("popstate", listener);
    };
};

/** The page's path within the site: "/" or "/p/iec-104". */
export const currentPath = () => {
    const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
    return path.replace(/\/+$/, "") || "/";
};

export const usePath = () => useSyncExternalStore(subscribe, currentPath, () => "/");

export const hrefOf = (path: string) => `${BASE}${path === "/" ? "/" : path}`;

export function navigate(path: string) {
    if (path === currentPath()) return;
    history.pushState(null, "", hrefOf(path));
    scrollTo({ top: 0 });
    for (const listener of listeners) listener();
}

/** A link inside the site: the page changes without a reload; a new tab or window still works. */
export function Link({ to, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
    const follow = (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(to);
    };
    return <a {...props} href={hrefOf(to)} onClick={follow} />;
}
