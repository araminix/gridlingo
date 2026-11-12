import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/i18n";
import { useTheme, type Theme } from "@/theme";

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** Light, dark, or as the system says. */
export function ThemeMenu() {
    const { t } = useI18n();
    const { theme, dark, setTheme } = useTheme();
    const Icon = dark ? Moon : Sun;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-10" aria-label={t("theme.label")}>
                    <Icon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t("theme.label")}</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
                    {(["light", "dark", "system"] as const).map((value) => {
                        const ItemIcon = ICONS[value];
                        return (
                            <DropdownMenuRadioItem key={value} value={value}>
                                <ItemIcon />
                                {t(`theme.${value}`)}
                            </DropdownMenuRadioItem>
                        );
                    })}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
