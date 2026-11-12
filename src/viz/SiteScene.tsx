import { useMemo, useSyncExternalStore } from "react";
import type { Frame, Scene } from "@/lessons/types";
import type { Words } from "@/lessons/words";
import { DeviceShape, extentOf, labelAt } from "./devices";
import { GRID, groundPath, project, round } from "./iso";

const reducedQuery = () => (typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null);
const subscribeReduced = (onChange: () => void) => {
    const query = reducedQuery();
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
};
/** Whether the reader asked for less motion: frames then sit at their destination instead of travelling. */
export const useReducedMotion = () => useSyncExternalStore(subscribeReduced, () => reducedQuery()?.matches ?? false, () => false);

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

/** The site: devices on an isometric ground, the cables between them, and the frame on its way. */
export function SiteScene({ scene, frame, words }: { scene: Scene; frame: Frame | undefined; words: Words }) {
    const reduced = useReducedMotion();
    const place = useMemo(() => new Map(scene.devices.map((device) => [device.id, [device.at[0] * GRID, device.at[1] * GRID] as const])), [scene]);

    const links = useMemo(
        () =>
            scene.links.flatMap((link) => {
                const from = place.get(link.from);
                const to = place.get(link.to);
                return from && to ? [{ link, path: groundPath(from, to, link.via) }] : [];
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

    const view = useMemo(() => {
        const all = scene.devices.flatMap((device) => extentOf(device.kind, device.at[0] * GRID, device.at[1] * GRID));
        const xs = all.map(([x]) => x);
        const ys = all.map(([, y]) => y);
        const [minX, maxX, minY, maxY] = [Math.min(...xs) - 70, Math.max(...xs) + 70, Math.min(...ys) - 48, Math.max(...ys) + 30];
        return { minX, minY, width: maxX - minX, height: maxY - minY };
    }, [scene]);

    const grid = useMemo(() => {
        const xs = scene.devices.map((device) => device.at[0]);
        const ys = scene.devices.map((device) => device.at[1]);
        const [x0, x1, y0, y1] = [Math.min(...xs) - 2, Math.max(...xs) + 2, Math.min(...ys) - 2, Math.max(...ys) + 2];
        const line = (a: [number, number], b: [number, number]) => `M${a.map(round).join(",")} L${b.map(round).join(",")}`;
        const list: string[] = [];
        for (let x = x0; x <= x1; x++) list.push(line(project(x * GRID, y0 * GRID), project(x * GRID, y1 * GRID)));
        for (let y = y0; y <= y1; y++) list.push(line(project(x0 * GRID, y * GRID), project(x1 * GRID, y * GRID)));
        return list.join(" ");
    }, [scene]);

    // Devices further back are drawn first
    const devices = [...scene.devices].sort((a, b) => a.at[0] + a.at[1] - (b.at[0] + b.at[1]));

    return (
        <svg
            viewBox={`${round(view.minX)} ${round(view.minY)} ${round(view.width)} ${round(view.height)}`}
            className="block h-auto max-h-[34rem] w-full"
            role="img"
            aria-label={scene.devices.map((device) => words.device(device.id)).join(", ")}
        >
            <path d={grid} fill="none" stroke="var(--viz-grid)" strokeWidth={1} />
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
