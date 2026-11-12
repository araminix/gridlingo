import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n";
import { Link } from "@/router";

export function NotFound() {
    const { t } = useI18n();
    return (
        <main id="main" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-5">
            <h1 className="text-3xl font-bold">{t("notFound.title")}</h1>
            <Button asChild>
                <Link to="/">{t("notFound.back")}</Link>
            </Button>
        </main>
    );
}
