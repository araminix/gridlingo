/** Isometric drawing: plan coordinates (x to the lower right, y to the lower left, z up) to the screen. */

/** One step of a scene's grid, in plan units. */
export const GRID = 44;

const COS = Math.cos(Math.PI / 6);

export type Point3 = readonly [x: number, y: number, z?: number];

export const project = (x: number, y: number, z = 0): [number, number] => [(x - y) * COS, (x + y) * 0.5 - z];

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
