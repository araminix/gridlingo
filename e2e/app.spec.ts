import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CATALOG } from "../src/lessons/catalog.ts";

// Any uncaught error in the page fails the test that caused it
let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
    pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => message.type() === "error" && pageErrors.push(message.text()));
});
test.afterEach(() => {
    expect(pageErrors, "errors in the page").toEqual([]);
});

/** A first-time visitor in English, in the light theme. */
async function open(page: Page, path: string) {
    await page.addInitScript(() => {
        if (sessionStorage.getItem("started")) return;
        localStorage.clear();
        localStorage.setItem("gridlingo.lang", '"en"');
        localStorage.setItem("gridlingo.theme", '"light"');
        sessionStorage.setItem("started", "1");
    });
    await page.goto(path);
}

const caption = (page: Page) => page.getByTestId("stage").getByText(/^Step \d+ of \d+/);

test("the library lists every protocol and filters them by device", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How energy devices talk");
    const cards = page.locator("main li a");
    await expect(cards).toHaveCount(CATALOG.length);
    await page.getByRole("group", { name: "Show protocols for a device" }).getByRole("button", { name: "Wind turbine" }).click();
    await expect(cards).toHaveCount(CATALOG.filter((meta) => meta.devices.includes("turbine")).length);
});

test("search finds a protocol by its port", async ({ page }) => {
    await open(page, "/");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").getByRole("combobox").fill("2404");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/p\/iec-104$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("IEC 60870-5-104");
});

test("a lesson moves step by step, with the buttons, the keys and on its own", async ({ page, isMobile }) => {
    await page.clock.install();
    await open(page, "/p/iec-104");
    await expect(caption(page)).toHaveText(/^Step 1 of 6/);
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(caption(page)).toHaveText(/^Step 2 of 6/);
    if (!isMobile) {
        await page.locator("body").press("ArrowRight");
        await expect(caption(page)).toHaveText(/^Step 3 of 6/);
        await page.locator("body").press("ArrowLeft");
        await expect(caption(page)).toHaveText(/^Step 2 of 6/);
    }
    await page.getByRole("button", { name: "Play" }).click();
    await page.clock.runFor(2700);
    await expect(caption(page)).toHaveText(/^Step 3 of 6/);
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: "Start again" }).click();
    await expect(caption(page)).toHaveText(/^Step 1 of 6/);
});

test("choosing a frame shows its bytes, and the sequence view lists the frames so far", async ({ page }) => {
    await open(page, "/p/iec-104");
    await page.getByTestId("stage").getByRole("button", { name: "Ask for everything" }).click();
    await page.getByRole("button", { name: /General interrogation: send me everything/ }).click();
    await expect(page.getByRole("heading", { name: "Bytes · C_IC_NA_1 · act" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Bytes" }).getByText("64", { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Sequence" }).click();
    await expect(page.getByRole("tabpanel").getByRole("listitem")).toHaveCount(5);
});

test("a beginner finds plain words, and what an abbreviation means", async ({ page }) => {
    await open(page, "/p/iec-104");
    await expect(page.getByText("In plain words")).toBeVisible();
    await page.getByRole("button", { name: "RTU", exact: true }).first().click();
    await expect(page.getByRole("dialog").getByText("Remote terminal unit")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
});

test("the theme and the language are kept, and Arabic reads right to left", async ({ page }) => {
    await open(page, "/p/iec-104");
    await page.getByRole("button", { name: "Theme" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("combobox", { name: "Language" }).click();
    await page.getByRole("listbox").locator('[lang="ar"]').click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveClass(/dark/);
});

test("on a phone the protocol list opens in a sheet", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phones only");
    await open(page, "/p/iec-104");
    await page.getByRole("button", { name: "All protocols" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "DNP3", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("DNP3");
    await expect(page.getByRole("dialog")).toBeHidden();
});

test("the encoder turns a value into bytes and back", async ({ page }) => {
    await open(page, "/p/iec-104");
    await page.getByLabel("Value", { exact: true }).fill("1.5");
    await expect(page.getByLabel("Bytes (hex)")).toHaveValue("00 00 C0 3F");
    await page.getByLabel("Bytes (hex)").fill("71 3D 9A 40");
    await expect(page.getByLabel("Value", { exact: true })).toHaveValue("4.82");
});

test("the SCL explorer reads the reader's own file", async ({ page }) => {
    await open(page, "/p/iec-61850-goose");
    await page.locator('input[type="file"]').setInputFiles("src/lessons/iec-61850-mms/pv-inverter.cid");
    await expect(page.getByText("pv-inverter.cid", { exact: true })).toBeVisible();
    await page.getByPlaceholder("Find an IED, a logical node, a data object or a value").fill("TotW");
    await expect(page.getByRole("treeitem").filter({ hasText: "TotW" }).first()).toBeVisible();
});

for (const theme of ["light", "dark"] as const)
    test(`the home page and a lesson pass the accessibility checks (${theme})`, async ({ page }) => {
        await open(page, "/");
        await page.evaluate((value) => localStorage.setItem("gridlingo.theme", JSON.stringify(value)), theme);
        for (const path of ["/", "/p/iec-61850-goose"]) {
            await page.goto(path);
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
            expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
        }
    });

test("every lesson opens and plays to its last step", async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, "/");
    for (const meta of CATALOG) {
        await page.goto(`/p/${meta.id}`);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(meta.name);
        await page.getByTestId("stage").locator("ol li button").last().click();
        await expect(page.getByTestId("frame").getByRole("heading")).toBeVisible();
    }
});
