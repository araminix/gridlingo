import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePersisted } from "./settings";

export type Theme = "light" | "dark";
const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark";

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Light (every first visit starts here) or dark, kept in this browser. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = usePersisted<Theme>("gridlingo.theme", "light", isTheme);
    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme]);
    const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme outside ThemeProvider");
    return context;
}
