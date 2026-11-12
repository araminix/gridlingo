import { expect, test, type Page } from "@playwright/test";
import { CATALOG } from "../src/lessons/catalog.ts";

// What the reader sees, compared with the screenshots in visual.spec.ts-snapshots: every lesson's site at its last
// step, the other views of a few, the library, the dark theme, a phone and right to left.

async function open(page: Page, path: string, { lang = "en", theme = "light" } = {}) {
    await page.addInitScript(
        ([lang, theme]) => {
            localStorage.setItem("gridlingo.lang", JSON.stringify(lang));
            localStorage.setItem("gridlingo.theme", JSON.stringify(theme));
        },
        [lang, theme],
    );
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
}

const lastStep = (page: Page) => page.getByTestId("stage").locator("ol li button").last().click();

test.describe("every lesson", () => {
    test.skip(({ isMobile }) => isMobile, "on a desktop");
    for (const meta of CATALOG)
        test(meta.id, async ({ page }) => {
            await open(page, `/p/${meta.id}`);
            await lastStep(page);
            await expect(page.getByTestId("stage")).toHaveScreenshot(`${meta.id}.png`);
        });
});

test.describe("the other views", () => {
    test.skip(({ isMobile }) => isMobile, "on a desktop");
    for (const id of ["iec-104", "iec-61850-goose", "iec-61850-mms", "dnp3", "mqtt"])
        test(`${id} in sequence`, async ({ page }) => {
            await open(page, `/p/${id}`);
            await lastStep(page);
            await page.getByRole("tab", { name: "Sequence" }).click();
            await expect(page.getByTestId("stage")).toHaveScreenshot(`${id}-sequence.png`);
        });
    for (const meta of CATALOG.filter((item) => ["substation"].includes(item.group)))
        test(`${meta.id} single-line, if it has one`, async ({ page }) => {
            await open(page, `/p/${meta.id}`);
            const tab = page.getByRole("tab", { name: "Single-line" });
            test.skip(!(await tab.count()), "no single-line view");
            await lastStep(page);
            await tab.click();
            await expect(page.getByTestId("stage")).toHaveScreenshot(`${meta.id}-single-line.png`);
        });
    test("the bytes, the timing and the names of GOOSE", async ({ page }) => {
        await open(page, "/p/iec-61850-goose");
        await page.getByTestId("stage").getByRole("button", { name: "Publish" }).click();
        await expect(page.getByRole("heading", { name: /^Bytes · / }).locator("xpath=ancestor::*[@data-slot='card'][1]")).toHaveScreenshot("goose-bytes.png");
        await expect(page.getByRole("heading", { name: "Why GOOSE never waits for an answer" }).locator("xpath=ancestor::*[@data-slot='card'][1]")).toHaveScreenshot("goose-timing.png");
    });
});

test("the library", async ({ page, isMobile }) => {
    await open(page, "/");
    await expect(page).toHaveScreenshot(`home-${isMobile ? "phone" : "desktop"}.png`);
});

test("the library, dark", async ({ page, isMobile }) => {
    await open(page, "/", { theme: "dark" });
    await expect(page).toHaveScreenshot(`home-dark-${isMobile ? "phone" : "desktop"}.png`);
});

test("a lesson, dark", async ({ page, isMobile }) => {
    await open(page, "/p/iec-104", { theme: "dark" });
    await page.getByTestId("stage").getByRole("button", { name: "Values arrive" }).click();
    await expect(page).toHaveScreenshot(`lesson-dark-${isMobile ? "phone" : "desktop"}.png`);
});

test("a lesson in Arabic, right to left", async ({ page, isMobile }) => {
    await open(page, "/p/iec-104", { lang: "ar" });
    await page.getByTestId("stage").locator("ol li button").nth(3).click();
    await expect(page).toHaveScreenshot(`lesson-arabic-${isMobile ? "phone" : "desktop"}.png`);
});
