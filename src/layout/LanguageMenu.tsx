import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "@/i18n/Flag";
import { useI18n } from "@/i18n/i18n";
import { LANGUAGES, isLanguage } from "@/i18n/languages";

/** The interface language, each one named in itself. */
export function LanguageMenu() {
    const { lang, setLang, t } = useI18n();
    return (
        <Select value={lang} onValueChange={(value) => isLanguage(value) && setLang(value)}>
            <SelectTrigger aria-label={t("lang.label")} className="h-10 gap-2 px-3">
                <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
                {LANGUAGES.map((language) => (
                    <SelectItem key={language.code} value={language.code} lang={language.code}>
                        <Flag code={language.code} />
                        <span className="max-sm:sr-only">{language.name}</span>
                        <span className="font-mono text-xs uppercase sm:hidden">{language.code}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
