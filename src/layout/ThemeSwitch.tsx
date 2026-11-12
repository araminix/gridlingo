import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n/i18n";
import { cn } from "@/lib/utils";
import { useTheme } from "@/theme";

/** One click between the light theme and the dark one; the knob sits on the theme in use. */
export function ThemeSwitch() {
    const { t } = useI18n();
    const { theme, setTheme } = useTheme();
    const dark = theme === "dark";
    return (
        <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-label={t("theme.dark")}
            title={t("theme.dark")}
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="relative flex h-10 w-[66px] shrink-0 items-center justify-between rounded-full border bg-card px-[11px] text-muted-foreground outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span
                aria-hidden="true"
                className={cn(
                    "absolute inset-y-[3px] start-[3px] w-8 rounded-full bg-primary shadow-sm transition-[translate] duration-200 motion-reduce:transition-none",
                    dark && "translate-x-[26px] rtl:-translate-x-[26px]",
                )}
            />
            <Sun aria-hidden="true" className={cn("relative size-4", !dark && "text-primary-foreground")} />
            <Moon aria-hidden="true" className={cn("relative size-4", dark && "text-primary-foreground")} />
        </button>
    );
}
