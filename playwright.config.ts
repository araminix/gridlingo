import { defineConfig, devices } from "@playwright/test";

// The tests run against the production build, on a desktop and a phone. Screenshots are compared with the ones in
// e2e/visual.spec.ts-snapshots (update them with `pnpm e2e --update-snapshots` after a visual change, and look at them).
export default defineConfig({
    testDir: "e2e",
    timeout: 60_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.25, animations: "disabled" } },
    use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", reducedMotion: "reduce" },
    webServer: {
        command: "pnpm build && pnpm preview --port 4173 --strictPort",
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
        { name: "phone", use: { ...devices["Pixel 7"] } },
    ],
});
