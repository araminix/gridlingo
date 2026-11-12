// Retakes the README pictures (docs/images) and the link-preview banner (public/social.png, 1280×640, also the repo's
// social preview on GitHub) from the running site. Run it after a visual change:
//   pnpm build && pnpm preview --port 4173 &
//   node scripts/screenshots.mjs
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const browser = await chromium.launch();

async function open(path, { lang = "en", theme = "light", step, ...context } = {}) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", ...context });
    await page.addInitScript(
        ([lang, theme]) => {
            localStorage.setItem("gridlingo.lang", JSON.stringify(lang));
            localStorage.setItem("gridlingo.theme", JSON.stringify(theme));
        },
        [lang, theme],
    );
    await page.goto(BASE + path);
    if (step !== undefined) await page.getByTestId("stage").locator("ol li button").nth(step).click();
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.fonts.ready);
    return page;
}

async function shoot(file, path, options) {
    const page = await open(path, options);
    await page.screenshot({ path: file, animations: "disabled" });
    await page.close();
}

await shoot("docs/images/lesson-light.png", "/p/iec-104", { step: -1 });
await shoot("docs/images/home-dark.png", "/", { theme: "dark" });
await shoot("docs/images/persian.png", "/p/iec-104", { lang: "fa", step: 3 });
await shoot("docs/images/phone.png", "/p/iec-61850-goose", { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, step: 1 });

// The banner: the home page's hero, without the header, the search and the library, with the name in large type
const page = await open("/", { viewport: { width: 1280, height: 640 } });
await page.addStyleTag({
    content: `
        header, footer, #main > section:nth-of-type(2) { display: none !important; }
        #main > section:first-of-type { height: 640px; border: 0; display: flex; align-items: center; }
        #main > section:first-of-type > div { width: 100%; grid-template-columns: minmax(0, 1fr) 32rem; padding: 0 56px; gap: 40px; }
        #main h1 { font-size: 50px; }
        .banner-name { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
        .banner-name svg { width: 48px; height: 48px; }
        .banner-site { font-size: 17px; color: var(--muted-foreground); }
    `,
});
await page.evaluate(() => {
    const column = document.querySelector("#main .max-w-3xl");
    column.querySelector(":scope > button").remove(); // the search
    column.lastElementChild.remove(); // "Start with"
    const name = document.createElement("div");
    name.className = "banner-name";
    name.append(document.querySelector("header svg").cloneNode(true), "Gridlingo");
    const site = document.createElement("p");
    site.className = "banner-site";
    site.textContent = "araminix.github.io/gridlingo";
    column.prepend(name);
    column.append(site);
});
await page.screenshot({ path: "public/social.png", animations: "disabled" });
await browser.close();
