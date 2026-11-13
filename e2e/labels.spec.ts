import { expect, test } from "@playwright/test";
import { CATALOG } from "../src/lessons/catalog.ts";

// Every label in every lesson's site must stay readable: no label may cover another label or any part of a device.

type Shape = [number, number][];

/** In the page, on a scene's svg: each label that covers another label or a part of a device, in words. */
function findClashes(svg: SVGSVGElement): string[] {
    const onScreen = (el: SVGGraphicsElement, list: [number, number][]): Shape => {
        const m = el.getScreenCTM()!;
        return list.map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
    };
    const box = (el: SVGGraphicsElement): Shape => {
        const b = el.getBBox();
        return onScreen(el, [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x + b.width, b.y + b.height],
            [b.x, b.y + b.height],
        ]);
    };
    // A device's faces are drawn as polygons and measured exactly; its other parts by the box around them
    const outline = (el: SVGGraphicsElement): Shape =>
        el instanceof SVGPolygonElement && el.points.length >= 3 ? onScreen(el, Array.from(el.points, (p) => [p.x, p.y] as [number, number])) : box(el);
    // How deep two convex shapes overlap, in pixels (0 when apart): their least overlap along the normal of any edge
    const depth = (a: Shape, b: Shape) => {
        let least = Infinity;
        for (const shape of [a, b])
            for (let i = 0; i < shape.length; i++) {
                const [p, q] = [shape[i]!, shape[(i + 1) % shape.length]!];
                const [nx, ny] = [q[1] - p[1], p[0] - q[0]];
                const length = Math.hypot(nx, ny);
                if (!length) continue;
                const along = (s: Shape) => s.map(([x, y]) => (x * nx + y * ny) / length);
                const [sa, sb] = [along(a), along(b)];
                least = Math.min(least, Math.min(Math.max(...sa), Math.max(...sb)) - Math.max(Math.min(...sa), Math.min(...sb)));
                if (least <= 0) return 0;
            }
        return least;
    };
    const devices = [...svg.querySelectorAll<SVGGElement>(":scope > g:has(> text)")];
    const nameOf = (device: Element) => device.querySelector(":scope > text")?.textContent ?? "?";
    // A label by its ink, not its line box: from cap height above its baseline to the descenders below it
    const ink = (el: SVGTextElement): Shape => {
        const b = el.getBBox();
        const base = el.y.baseVal[0]?.value ?? b.y + b.height;
        const size = parseFloat(getComputedStyle(el).fontSize);
        return onScreen(el, [
            [b.x, base - 0.74 * size],
            [b.x + b.width, base - 0.74 * size],
            [b.x + b.width, base + 0.22 * size],
            [b.x, base + 0.22 * size],
        ]);
    };
    const labels = [...svg.querySelectorAll<SVGTextElement>(":scope > g > text, :scope > text")].map((el) => ({ name: el.textContent ?? "", shape: ink(el) }));
    const parts = devices.flatMap((device) =>
        [...device.querySelectorAll<SVGGraphicsElement>(":scope > g :is(polygon, path, ellipse, circle, rect)")].map((el) => ({ device: nameOf(device), shape: outline(el) })),
    );
    // Overlaps count in the drawing's own units, not the screen's: the picture grows with the screen, the answer must not
    const frame = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    const unit = Math.min(frame.width / view.width, frame.height / view.height);
    const clashes = new Set<string>();
    for (const [i, label] of labels.entries()) {
        for (const other of labels.slice(i + 1)) if (depth(label.shape, other.shape) > unit) clashes.add(`"${label.name}" covers the label "${other.name}"`);
        for (const part of parts) if (depth(label.shape, part.shape) > unit) clashes.add(`"${label.name}" covers part of ${part.device}`);
    }
    return [...clashes];
}

test.describe("the labels of every site", () => {
    test.skip(({ isMobile }) => isMobile, "on a desktop");
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem("gridlingo.lang", '"en"');
            localStorage.setItem("gridlingo.theme", '"light"');
        });
    });
    test("the home page", async ({ page }) => {
        await page.goto("/");
        await page.evaluate(() => document.fonts.ready);
        expect(await page.locator("#main section").first().locator("svg[role=img]").evaluate(findClashes)).toEqual([]);
    });
    for (const meta of CATALOG)
        test(meta.id, async ({ page }) => {
            await page.goto(`/p/${meta.id}`);
            await page.evaluate(() => document.fonts.ready);
            expect(await page.getByTestId("stage").locator("svg[role=img]").evaluate(findClashes)).toEqual([]);
        });
});
