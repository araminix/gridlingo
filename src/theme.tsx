import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { usePersisted } from "./settings";

export type Theme = "light" | "dark" | "system";
const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark" || value === "system";

const darkQuery = () => (typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null);
const subscribe = (onChange: () => void) => {
    const query = darkQuery();
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
};
const systemDark = () => darkQuery()?.matches ?? false;

interface ThemeState {
    theme: Theme;
    dark: boolean;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Light, dark, or as the system says (the default), kept in this browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = usePersisted<Theme>("gridlingo.theme", "system", isTheme);
    const system = useSyncExternalStore(subscribe, systemDark, () => false);
    const dark = theme === "dark" || (theme === "system" && system);
    useEffect(() => {
        document.documentElement.classList.toggle("dark", dark);
    }, [dark]);
    const value = useMemo(() => ({ theme, dark, setTheme }), [theme, dark, setTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme outside ThemeProvider");
    return context;
}
