import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n";
import { Link } from "@/router";
import { LanguageMenu } from "./LanguageMenu";
import { Logo } from "./Logo";
import { SearchButton, SearchDialog } from "./Search";
import { ThemeMenu } from "./ThemeMenu";

export const REPOSITORY = "https://github.com/araminix/gridlingo";

/** GitHub's mark (lucide has no brand icons). */
function GithubMark() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
        </svg>
    );
}

export function Header({ search = true }: { search?: boolean }) {
    const { t } = useI18n();
    return (
        <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/75">
            <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
                <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Logo className="size-8" />
                    <span className="flex flex-col leading-tight">
                        <span className="text-lg font-bold tracking-tight">Gridlingo</span>
                        <span className="text-xs text-muted-foreground max-md:hidden">{t("app.tagline")}</span>
                    </span>
                </Link>
                <div className="ms-auto flex items-center gap-2">
                    {search && <SearchButton />}
                    <LanguageMenu />
                    <ThemeMenu />
                    <Button variant="outline" size="icon" className="size-10 max-[380px]:hidden" asChild>
                        <a href={REPOSITORY} aria-label={t("app.source")}>
                            <GithubMark />
                        </a>
                    </Button>
                </div>
            </div>
            <SearchDialog />
        </header>
    );
}

export function Footer() {
    const { t } = useI18n();
    return (
        <footer className="border-t">
            <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground">
                <p>{t("footer.note")}</p>
                <p>
                    <a href={REPOSITORY} className="font-medium text-foreground underline-offset-4 hover:underline">
                        {t("footer.source")}
                    </a>
                </p>
            </div>
        </footer>
    );
}
