/** 3D drawing: plan coordinates (x to the lower right, y to the lower left, z up) to the screen. */

/** One step of a scene's grid, in plan units. */
export const GRID = 44;

const COS = Math.cos(Math.PI / 6);

export type Point3 = readonly [x: number, y: number, z?: number];

/** The isometric view, without depth: how the site looks from very far away. */
const flat = (x: number, y: number, z: number): [number, number] => [(x - y) * COS, (x + y) * 0.5 - z];

// The camera looks at the site from the front and above, along (1, 1, 1), from CAMERA plan units away: near enough that
// what is in front is drawn a little bigger and parallel lines lean together, as the eye sees it, and far enough that
// the picture still reads like a plan. It aims at the middle of a usual scene.
const CAMERA = 2000;
const AIM = [4.5 * GRID, 2.2 * GRID] as const;
const [AIM_X, AIM_Y] = flat(AIM[0], AIM[1], 0);

/** A point of the site on the screen, in perspective. */
export function project(x: number, y: number, z = 0): [number, number] {
    const [sx, sy] = flat(x, y, z);
    const nearer = (x + y + z - AIM[0] - AIM[1]) / Math.sqrt(3);
    const scale = CAMERA / (CAMERA - nearer);
    return [AIM_X + (sx - AIM_X) * scale, AIM_Y + (sy - AIM_Y) * scale];
}

/**
 * The sun, at the top left of the screen as in most drawings: on the -x side and a little toward +y, so tops are
 * brightest, the faces turned to +y (left on the screen) half lit and those turned to +x (right) in shade. Shadows fall
 * to the right on the screen; per unit of height, a shadow reaches this far on the plan.
 */
export const LIGHT = { x: 0.62, y: -0.18 } as const;

/** Points for an SVG polygon or polyline. */
export const points = (...list: Point3[]) =>
    list
        .map(([x, y, z]) => {
            const [sx, sy] = project(x, y, z);
            return `${round(sx)},${round(sy)}`;
        })
        .join(" ");

export const round = (value: number) => Math.round(value * 10) / 10;

/** A box standing on the ground, centred on (cx, cy): w along x, d along y, h up, from height z. */
export interface Box {
    cx: number;
    cy: number;
    w: number;
    d: number;
    h: number;
    z?: number;
}

/** The three faces a viewer sees: the top, the one facing +y (left on screen) and the one facing +x (right). */
export function faces({ cx, cy, w, d, h, z = 0 }: Box) {
    const [x0, x1, y0, y1, top] = [cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2, z + h];
    return {
        top: points([x0, y0, top], [x1, y0, top], [x1, y1, top], [x0, y1, top]),
        left: points([x0, y1, z], [x1, y1, z], [x1, y1, top], [x0, y1, top]),
        right: points([x1, y0, z], [x1, y1, z], [x1, y1, top], [x1, y0, top]),
        /** A point on the left face: u along it (0 at its left end), v up (0 at the bottom). */
        onLeft: (u: number, v: number) => project(x0 + u * w, y1, z + v * h),
        /** A point on the right face: u along it (0 at its left end), v up. */
        onRight: (u: number, v: number) => project(x1, y0 + u * d, z + v * h),
        /** A point on the top: u along x, v along y. */
        onTop: (u: number, v: number) => project(x0 + u * w, y0 + v * d, top),
    };
}

/** A path on the ground from one point to another along the grid's axes: along x first, or along y first. */
export function groundPath(from: readonly [number, number], to: readonly [number, number], via: "x" | "y" = "x") {
    const corner: [number, number] = via === "x" ? [to[0], from[1]] : [from[0], to[1]];
    const list = [from, corner, to].map(([x, y]) => project(x, y));
    const d = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${round(x)},${round(y)}`).join(" ");
    // The label goes in the middle of the longer leg, along it, turned so that it never reads upside down
    const [a, b, c] = list as [[number, number], [number, number], [number, number]];
    const [p, q] = Math.hypot(b[0] - a[0], b[1] - a[1]) >= Math.hypot(c[0] - b[0], c[1] - b[1]) ? [a, b] : [b, c];
    let angle = (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle <= -90) angle += 180;
    const middle: [number, number] = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    return { d: d(list), reverse: d([...list].reverse()), middle, angle, points: list };
}

/** The convex hull of some screen points, in order around it. */
function hull(list: [number, number][]): [number, number][] {
    const sorted = [...list].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (points: [number, number][]) => {
        const out: [number, number][] = [];
        for (const p of points) {
            while (out.length >= 2 && turn(out.at(-2)!, out.at(-1)!, p) <= 0) out.pop();
            out.push(p);
        }
        out.pop();
        return out;
    };
    return [...half(sorted), ...half(sorted.reverse())];
}

/** The shadow a box casts on the ground in the LIGHT, as SVG polygon points (with h 0, just its footprint). */
export function shadowOf({ cx, cy, w, d, h, z = 0 }: Box): string {
    const corners: [number, number][] = [
        [cx - w / 2, cy - d / 2],
        [cx + w / 2, cy - d / 2],
        [cx + w / 2, cy + d / 2],
        [cx - w / 2, cy + d / 2],
    ];
    const at = (lift: number) => corners.map(([x, y]) => project(x + lift * LIGHT.x, y + lift * LIGHT.y));
    return hull([...at(z), ...at(z + h)])
        .map(([x, y]) => `${round(x)},${round(y)}`)
        .join(" ");
}
