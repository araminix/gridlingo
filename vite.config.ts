import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";
import { CATALOG } from "./src/lessons/catalog.ts";

const en: Record<string, string> = JSON.parse(readFileSync(new URL("./src/i18n/locales/en.json", import.meta.url), "utf8"));

/** Where the site is published: link previews and the sitemap need full addresses. A fork that hosts elsewhere sets SITE_URL. */
const SITE = process.env.SITE_URL ?? "https://araminix.github.io/gridlingo/";

/** Runs before the app, inline in the page's head, so that the theme and the text direction are right from the first paint. */
const START = readFileSync(new URL("./src/start.js", import.meta.url), "utf8").trim();

// GitHub Pages sends no security headers, so the page carries its own policy: nothing is loaded from elsewhere, and the
// only inline script is START, allowed by its hash. Vite inlines the smallest font files as data: addresses
const POLICY = `default-src 'self'; script-src 'self' 'sha256-${createHash("sha256").update(START).digest("base64")}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'`;

interface Page {
    path: string;
    title: string;
    description: string;
}

const home: Page = { path: "", title: `Gridlingo · ${en["home.title"]}`, description: en["home.lead"] };
const lessons: Page[] = CATALOG.map((meta) => ({
    path: `p/${meta.id}/`,
    title: `${meta.name} · Gridlingo`,
    description: `${meta.name}: ${en[`lesson.${meta.id}.summary`]}. ${en["home.lead"]}`,
}));

const attribute = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fill = (html: string, page: Page) =>
    html
        .replaceAll("%TITLE%", attribute(page.title))
        .replaceAll("%DESCRIPTION%", attribute(page.description))
        .replaceAll("%URL%", `${SITE}${page.path}`)
        .replaceAll("%SITE%", SITE);

/**
 * One HTML file per lesson (p/<id>/index.html), so that a lesson's address opens on GitHub Pages and search engines and
 * link previews see its own title and description; 404.html for any other address; the sitemap. While developing, the
 * page served gets the title of its address.
 */
function pages(): Plugin {
    return {
        name: "gridlingo-pages",
        enforce: "post",
        transformIndexHtml: {
            order: "post",
            handler(html, context) {
                html = html.replace("</title>", `</title>\n        <script>${START}</script>`);
                if (!context.server) return html.replace("<head>", `<head>\n        <meta http-equiv="Content-Security-Policy" content="${POLICY}" />`);
                const lesson = lessons.find((page) => context.originalUrl?.replace(/^\//, "").replace(/\/?$/, "/") === page.path);
                return fill(html, lesson ?? home);
            },
        },
        generateBundle(_, bundle) {
            const index = bundle["index.html"];
            if (index?.type !== "asset") return;
            const template = String(index.source);
            index.source = fill(template, home);
            for (const page of lessons) this.emitFile({ type: "asset", fileName: `${page.path}index.html`, source: fill(template, page) });
            this.emitFile({ type: "asset", fileName: "404.html", source: fill(template, home).replace("<head>", '<head>\n        <meta name="robots" content="noindex" />') });
            const urls = [home, ...lessons].map((page) => `  <url><loc>${SITE}${page.path}</loc></url>`).join("\n");
            this.emitFile({ type: "asset", fileName: "sitemap.xml", source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
        },
    };
}

// BASE_PATH is "/gridlingo/" on GitHub Pages (set by the workflow) and "/" everywhere else.
export default defineConfig({
    base: process.env.BASE_PATH ?? "/",
    plugins: [react(), tailwindcss(), pages()],
    resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.{ts,tsx}"],
    },
});
