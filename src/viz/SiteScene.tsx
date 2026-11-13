import { Fragment, useId, useMemo, useSyncExternalStore } from "react";
import type { Frame, Scene } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { bodyOf, DeviceShape, extentOf, labelAt, reachOf } from "./devices";
import { faces, GRID, groundPath, project, round, shadowOf } from "./iso";

const reducedQuery = () => (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null);
const subscribeReduced = (onChange: () => void) => {
    const query = reducedQuery();
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
};
/** Whether the reader asked for less motion: frames then sit at their destination instead of travelling. */
export const useReducedMotion = () => useSyncExternalStore(subscribeReduced, () => reducedQuery()?.matches ?? false, () => false);

/**
 * The ground under a scene, in grid cells: its lines a whole number of cells from the devices, and wide enough to hold
 * every part of every device (bodyOf) with `margin` cells to spare.
 */
export function groundOf(scene: Scene, margin: number) {
    const parts = scene.devices.flatMap((device) => bodyOf(device.kind, device.at[0] * GRID, device.at[1] * GRID));
    const span = (low: number, high: number, anchor: number) => [anchor + Math.floor(low / GRID - margin - anchor), anchor + Math.ceil(high / GRID + margin - anchor)] as const;
    const [x0, x1] = span(Math.min(...parts.map((p) => p.cx - p.w / 2)), Math.max(...parts.map((p) => p.cx + p.w / 2)), Math.min(...scene.devices.map((device) => device.at[0])));
    const [y0, y1] = span(Math.min(...parts.map((p) => p.cy - p.d / 2)), Math.max(...parts.map((p) => p.cy + p.d / 2)), Math.min(...scene.devices.map((device) => device.at[1])));
    return { x0, x1, y0, y1 };
}

const targetsOf = (frame: Frame) => (typeof frame.to === "string" ? [frame.to] : [...frame.to]);

type Leg = { link: Scene["links"][number]; path: ReturnType<typeof groundPath> };

/** The links from one device to another with the fewest hops, each with the way it is crossed; empty when none joins them. */
function routeOf(legs: readonly Leg[], from: string, to: string): { leg: Leg; forward: boolean }[] {
    const reached = new Map<string, { leg: Leg; forward: boolean; previous: string } | null>([[from, null]]);
    const queue = [from];
    while (queue.length) {
        const here = queue.shift()!;
        if (here === to) break;
        for (const leg of legs) {
            const next = leg.link.from === here ? leg.link.to : leg.link.to === here ? leg.link.from : null;
            if (next === null || reached.has(next)) continue;
            reached.set(next, { leg, forward: leg.link.from === here, previous: here });
            queue.push(next);
        }
    }
    const route: { leg: Leg; forward: boolean }[] = [];
    for (let step = reached.get(to); step; step = reached.get(step.previous)) route.unshift({ leg: step.leg, forward: step.forward });
    return route;
}

/** How thick the ground is drawn when it floats as a plate. */
const PLATE = 12;

/**
 * The site: devices on an isometric ground, the cables between them, and the frame on its way. With `plate`, the ground
 * is a slab floating over the page (the home page), not a grid running to the picture's edges.
 */
export function SiteScene({ scene, frame, words, plate = false }: { scene: Scene; frame: Frame | undefined; words: Pick<Words, "device">; plate?: boolean }) {
    const reduced = useReducedMotion();
    const place = useMemo(() => new Map(scene.devices.map((device) => [device.id, [device.at[0] * GRID, device.at[1] * GRID] as const])), [scene]);

    const links = useMemo(
        () =>
            scene.links.flatMap((link) => {
                const from = place.get(link.from);
                const to = place.get(link.to);
                if (!from || !to) return [];
                // Along which axis the cable leaves each device: a straight cable keeps its one axis
                const axis = (end: 0 | 1): "x" | "y" => (from[0] === to[0] ? "y" : from[1] === to[1] ? "x" : (end === 0) === (link.via !== "y") ? "x" : "y");
                const kind = (id: string) => scene.devices.find((device) => device.id === id)!.kind;
                const reach = [reachOf(kind(link.from), axis(0)) + 12, reachOf(kind(link.to), axis(1)) + 12] as const;
                return [{ link, path: groundPath(from, to, link.via, reach) }];
            }),
        [scene, place],
    );

    // The frame travels from its sender to each receiver over the fewest links (through a switch or a broker), or on the one it names
    const travels = frame
        ? targetsOf(frame).flatMap((target) => {
              const route = frame.link ? links.filter(({ link }) => link.id === frame.link).map((leg) => ({ leg, forward: leg.link.to !== frame.from })) : routeOf(links, frame.from, target);
              if (!route.length) return [];
              const list = route.flatMap(({ leg, forward }, i) => {
                  const pts = forward ? leg.path.points : [...leg.path.points].reverse();
                  return i ? pts.slice(1) : pts;
              });
              return [{ ids: route.map(({ leg }) => leg.link.id), d: list.map(([x, y], i) => `${i ? "L" : "M"}${round(x)},${round(y)}`).join(" "), end: list.at(-1)! }];
          })
        : [];
    const busy = new Set(travels.flatMap((travel) => travel.ids));

    // The ground's grid, around every device (closer on a plate), and the slab under it
    const ground = useMemo(() => {
        const { x0, x1, y0, y1 } = groundOf(scene, plate ? 0.75 : 1.5);
        const [nx, ny] = [Math.round(x1 - x0), Math.round(y1 - y0)];
        const at = (x: number, y: number, z = 0) => project(x * GRID, y * GRID, z);
        const line = (a: [number, number], b: [number, number]) => `M${a.map(round).join(",")} L${b.map(round).join(",")}`;
        const list: string[] = [];
        for (let i = 0; i <= nx; i++) list.push(line(at(x0 + i, y0), at(x0 + i, y1)));
        for (let j = 0; j <= ny; j++) list.push(line(at(x0, y0 + j), at(x1, y0 + j)));
        const slab = faces({ cx: ((x0 + x1) / 2) * GRID, cy: ((y0 + y1) / 2) * GRID, w: nx * GRID, d: ny * GRID, h: PLATE, z: -PLATE });
        const corners = [at(x0, y0), at(x1, y0), at(x1, y1, -PLATE), at(x0, y1)];
        return { grid: list.join(" "), slab, corners };
    }, [scene, plate]);

    // The picture frames the devices and their labels; a plate is shown whole
    const view = useMemo(() => {
        const all = [...scene.devices.flatMap((device) => extentOf(device.kind, device.at[0] * GRID, device.at[1] * GRID)), ...(plate ? ground.corners : [])];
        const xs = all.map(([x]) => x);
        const ys = all.map(([, y]) => y);
        const [side, below] = plate ? [4, 4] : [70, 30];
        const [minX, maxX, minY, maxY] = [Math.min(...xs) - side, Math.max(...xs) + side, Math.min(...ys) - 48, Math.max(...ys) + below];
        return { minX, minY, width: maxX - minX, height: maxY - minY };
    }, [scene, plate, ground]);

    // Each device's shadow on the ground, in the scene's one light, and a darker one just around its foot
    const shadows = useMemo(
        () =>
            scene.devices.map((device) => {
                const parts = bodyOf(device.kind, device.at[0] * GRID, device.at[1] * GRID);
                const grounded = parts.filter((part) => !part.z);
                return { id: device.id, cast: parts.map(shadowOf), foot: grounded.map((part) => shadowOf({ ...part, w: part.w + 5, d: part.d + 5, h: 0 })) };
            }),
        [scene],
    );
    const soft = useId();

    // Devices further back are drawn first
    const devices = [...scene.devices].sort((a, b) => a.at[0] + a.at[1] - (b.at[0] + b.at[1]));

    return (
        <svg
            viewBox={`${round(view.minX)} ${round(view.minY)} ${round(view.width)} ${round(view.height)}`}
            className={plate ? "block h-auto max-h-[70vh] w-full overflow-visible" : "block h-auto max-h-[max(20rem,calc(100vh-21rem))] w-full"}
            role="img"
            aria-label={scene.devices.map((device) => words.device(device.id)).join(", ")}
        >
            {plate && (
                <g stroke="var(--viz-edge)" strokeOpacity={0.3} strokeLinejoin="round" style={{ filter: "drop-shadow(0 28px 26px var(--viz-shadow))" }}>
                    <polygon points={ground.slab.left} fill="var(--viz-left)" />
                    <polygon points={ground.slab.right} fill="var(--viz-right)" />
                    <polygon points={ground.slab.top} fill="var(--viz-ground)" />
                </g>
            )}
            <defs>
                <filter id={soft} x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur stdDeviation={2.2} />
                </filter>
            </defs>
            <path d={ground.grid} fill="none" stroke="var(--viz-grid)" strokeWidth={1} />
            {links.map(({ link, path }) => (
                <path
                    key={link.id}
                    d={path.d}
                    fill="none"
                    stroke={link.active || busy.has(link.id) ? "var(--primary)" : "var(--viz-link)"}
                    strokeWidth={link.active || busy.has(link.id) ? 3 : 2}
                    strokeDasharray={link.radio ? "2 6" : link.active || busy.has(link.id) ? undefined : "5 4"}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
            <g fill="var(--viz-shade)" filter={`url(#${soft})`}>
                {shadows.map((shadow) => (
                    <Fragment key={shadow.id}>
                        {shadow.cast.map((points) => (
                            <polygon key={points} points={points} />
                        ))}
                        {shadow.foot.map((points) => (
                            <polygon key={points} points={points} />
                        ))}
                    </Fragment>
                ))}
            </g>
            {devices.map((device) => {
                const [cx, cy] = place.get(device.id)!;
                const [lx, ly] = labelAt(device.kind, cx, cy);
                return (
                    <g key={device.id}>
                        <DeviceShape kind={device.kind} cx={cx} cy={cy} active={device.active ?? false} />
                        <text x={round(lx)} y={round(ly - (device.address ? 13 : 0))} textAnchor="middle" className="fill-foreground text-[12.5px] font-semibold" paintOrder="stroke" stroke="var(--viz-ground)" strokeWidth={4}>
                            {words.device(device.id)}
                        </text>
                        {device.address && (
                            <text x={round(lx)} y={round(ly)} textAnchor="middle" className="fill-muted-foreground font-mono text-[10.5px]" paintOrder="stroke" stroke="var(--viz-ground)" strokeWidth={4}>
                                {device.address}
                            </text>
                        )}
                    </g>
                );
            })}
            {links.map(
                ({ link, path }) =>
                    link.label && (
                        <text
                            key={link.id}
                            x={round(path.middle[0])}
                            y={round(path.middle[1] - 6)}
                            transform={`rotate(${round(path.angle)} ${round(path.middle[0])} ${round(path.middle[1])})`}
                            textAnchor="middle"
                            className={`font-mono text-[10.5px] ${link.active || busy.has(link.id) ? "fill-primary font-semibold" : "fill-muted-foreground"}`}
                            paintOrder="stroke"
                            stroke="var(--viz-ground)"
                            strokeWidth={4}
                        >
                            {link.label}
                        </text>
                    ),
            )}
            {frame &&
                travels.map((travel) =>
                    reduced ? (
                        <circle key={`${frame.id}${travel.ids.join()}`} cx={round(travel.end[0])} cy={round(travel.end[1])} r={6.5} fill="var(--viz-token)" stroke="var(--viz-ground)" strokeWidth={2} />
                    ) : (
                        <circle key={`${frame.id}${travel.ids.join()}`} r={6.5} fill="var(--viz-token)" stroke="var(--viz-ground)" strokeWidth={2} data-token="">
                            <animateMotion dur="1.1s" fill="freeze" path={travel.d} calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                        </circle>
                    ),
                )}
        </svg>
    );
}
