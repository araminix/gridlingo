import type { ReactNode } from "react";
import type { DeviceKind } from "@/lessons/types";
import { faces, points, project, round, type Box } from "./iso";

/** Each kind's footprint (w along x, d along y) and height, in plan units. */
const SIZE: Record<DeviceKind, { w: number; d: number; h: number }> = {
    scada: { w: 52, d: 40, h: 64 },
    rtu: { w: 28, d: 22, h: 62 },
    gateway: { w: 30, d: 22, h: 22 },
    relay: { w: 26, d: 20, h: 52 },
    breaker: { w: 24, d: 24, h: 30 },
    "merging-unit": { w: 24, d: 20, h: 20 },
    clock: { w: 26, d: 20, h: 24 },
    switch: { w: 44, d: 24, h: 12 },
    inverter: { w: 26, d: 20, h: 40 },
    pv: { w: 112, d: 52, h: 18 },
    battery: { w: 92, d: 34, h: 38 },
    turbine: { w: 8, d: 8, h: 130 },
    meter: { w: 18, d: 10, h: 30 },
    charger: { w: 16, d: 16, h: 52 },
    car: { w: 62, d: 28, h: 26 },
    broker: { w: 34, d: 30, h: 48 },
    cloud: { w: 40, d: 34, h: 40 },
    pmu: { w: 26, d: 20, h: 26 },
    building: { w: 60, d: 48, h: 84 },
    sensor: { w: 8, d: 8, h: 40 },
    laptop: { w: 30, d: 22, h: 16 },
    transformer: { w: 44, d: 30, h: 38 },
    controller: { w: 30, d: 22, h: 46 },
    radio: { w: 8, d: 8, h: 110 },
};

/** How high a device reaches above the ground. */
export const heightOf = (kind: DeviceKind) => (kind === "turbine" ? SIZE.turbine.h + 44 : kind === "radio" ? SIZE.radio.h + 12 : SIZE[kind].h);

/** Where a device's label goes: above its highest point on the screen (the top's back corner). */
export function labelAt(kind: DeviceKind, cx: number, cy: number): [number, number] {
    const { w, d } = SIZE[kind];
    const [x, y] = project(cx, cy, heightOf(kind));
    return [x, y - (kind === "turbine" ? 0 : (w + d) / 4) - 6];
}

/** The plan points a device covers, so a scene can fit around it. */
export function extentOf(kind: DeviceKind, cx: number, cy: number): [number, number][] {
    const { w, d } = SIZE[kind];
    const h = heightOf(kind);
    const reach = kind === "turbine" ? 44 : 0;
    return [
        project(cx - w / 2 - reach, cy - d / 2, h),
        project(cx + w / 2 + reach, cy + d / 2, 0),
        project(cx - w / 2, cy + d / 2 + reach, h),
        project(cx + w / 2, cy - d / 2 - reach, h),
    ];
}

const tones = (active: boolean) =>
    active
        ? { top: "var(--viz-active-top)", left: "var(--viz-active-left)", right: "var(--viz-active-right)", edge: "var(--primary)", width: 1.5 }
        : { top: "var(--viz-top)", left: "var(--viz-left)", right: "var(--viz-right)", edge: "var(--viz-edge)", width: 1 };

function Solid({ box, active }: { box: Box; active: boolean }) {
    const f = faces(box);
    const tone = tones(active);
    return (
        <>
            <polygon points={f.left} fill={tone.left} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
            <polygon points={f.right} fill={tone.right} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
            <polygon points={f.top} fill={tone.top} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
        </>
    );
}

const pair = ([x, y]: [number, number]) => `${round(x)},${round(y)}`;
const quad = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => [a, b, c, d].map(pair).join(" ");

/** A rectangle on a face: from (u0, v0) to (u1, v1) of the face. */
function Panel({ on, u0, v0, u1, v1, fill }: { on: (u: number, v: number) => [number, number]; u0: number; v0: number; u1: number; v1: number; fill: string }) {
    return <polygon points={quad(on(u0, v0), on(u1, v0), on(u1, v1), on(u0, v1))} fill={fill} />;
}

function Leds({ on, v = 0.84, at = [0.25, 0.45, 0.65] }: { on: (u: number, v: number) => [number, number]; v?: number; at?: number[] }) {
    return (
        <>
            {at.map((u, i) => {
                const [x, y] = on(u, v);
                return <circle key={u} cx={round(x)} cy={round(y)} r={2.2} fill={i === 1 ? "var(--viz-token)" : "var(--viz-ok)"} />;
            })}
        </>
    );
}

function Lines({ list, stroke = "var(--viz-edge)", width = 1 }: { list: [number, number][][]; stroke?: string; width?: number }) {
    return <path d={list.map((line) => line.map((p, i) => `${i ? "L" : "M"}${pair(p)}`).join(" ")).join(" ")} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
}

/** A device of its kind standing at (cx, cy) on the ground. */
export function DeviceShape({ kind, cx, cy, active = false }: { kind: DeviceKind; cx: number; cy: number; active?: boolean }) {
    const size = SIZE[kind];
    const box: Box = { cx, cy, ...size };
    const f = faces(box);
    const tone = tones(active);
    let detail: ReactNode = null;

    switch (kind) {
        case "scada":
        case "laptop": {
            if (kind === "laptop") {
                // A thin base and a screen standing at its back
                const base: Box = { cx, cy, w: size.w, d: size.d, h: 3 };
                const screen: Box = { cx, cy: cy - size.d / 2 + 1.5, w: size.w, d: 3, h: size.h };
                const s = faces(screen);
                return (
                    <g>
                        <Solid box={base} active={active} />
                        <Solid box={screen} active={active} />
                        <Panel on={s.onLeft} u0={0.1} v0={0.25} u1={0.9} v1={0.9} fill="var(--viz-screen)" />
                    </g>
                );
            }
            const trend = [0.16, 0.3, 0.44, 0.58, 0.72, 0.84].map((u, i) => f.onLeft(u, [0.62, 0.7, 0.55, 0.66, 0.5, 0.58][i]!));
            detail = (
                <>
                    <Panel on={f.onLeft} u0={0.1} v0={0.4} u1={0.9} v1={0.88} fill="var(--viz-screen)" />
                    <Lines list={[trend]} stroke="var(--viz-token)" width={1.5} />
                </>
            );
            break;
        }
        case "rtu":
        case "gateway":
        case "controller":
        case "pmu":
        case "merging-unit":
            detail = (
                <>
                    {kind !== "gateway" && kind !== "merging-unit" && <Panel on={f.onLeft} u0={0.18} v0={0.5} u1={0.82} v1={0.68} fill="var(--viz-screen)" />}
                    <Leds on={f.onLeft} v={kind === "gateway" || kind === "merging-unit" ? 0.55 : 0.84} />
                </>
            );
            break;
        case "relay":
            detail = (
                <>
                    <Panel on={f.onLeft} u0={0.15} v0={0.58} u1={0.85} v1={0.8} fill="var(--viz-screen)" />
                    <Leds on={f.onLeft} v={0.42} at={[0.3, 0.5, 0.7]} />
                </>
            );
            break;
        case "clock": {
            const [x, y] = f.onLeft(0.5, 0.5);
            detail = (
                <>
                    <circle cx={round(x)} cy={round(y)} r={6} fill="var(--viz-screen)" />
                    <path d={`M${round(x)},${round(y)} l0,-4 M${round(x)},${round(y)} l3,1.5`} stroke="var(--viz-token)" strokeWidth={1.4} strokeLinecap="round" />
                </>
            );
            break;
        }
        case "switch":
            detail = (
                <>
                    {[0.12, 0.28, 0.44, 0.6, 0.76].map((u) => (
                        <Panel key={u} on={f.onLeft} u0={u} v0={0.25} u1={u + 0.1} v1={0.75} fill="var(--viz-screen)" />
                    ))}
                </>
            );
            break;
        case "inverter":
            detail = (
                <>
                    <Panel on={f.onLeft} u0={0.2} v0={0.62} u1={0.8} v1={0.8} fill="var(--viz-screen)" />
                    <Lines list={[0.2, 0.35, 0.5, 0.65, 0.8].map((u) => [f.onRight(u, 0.15), f.onRight(u, 0.85)])} />
                </>
            );
            break;
        case "battery":
            detail = <Lines list={[0.33, 0.66].map((u) => [f.onLeft(u, 0.06), f.onLeft(u, 0.94)])} />;
            break;
        case "breaker":
        case "transformer": {
            const tops = kind === "breaker" ? [0.3, 0.7] : [0.25, 0.5, 0.75];
            detail = (
                <>
                    {kind === "transformer" && <Lines list={[0.2, 0.35, 0.5, 0.65, 0.8].map((u) => [f.onLeft(u, 0.12), f.onLeft(u, 0.88)])} />}
                    {tops.map((u) => {
                        const [x, y] = f.onTop(u, 0.5);
                        return (
                            <g key={u}>
                                <path d={`M${round(x)},${round(y)} l0,-12`} stroke={tone.edge} strokeWidth={2} strokeLinecap="round" />
                                <circle cx={round(x)} cy={round(y - 13)} r={2.4} fill={tone.top} stroke={tone.edge} />
                            </g>
                        );
                    })}
                </>
            );
            break;
        }
        case "meter":
            detail = <Panel on={f.onLeft} u0={0.14} v0={0.55} u1={0.86} v1={0.78} fill="var(--viz-screen)" />;
            break;
        case "charger": {
            const [x, y] = f.onLeft(0.85, 0.45);
            detail = (
                <>
                    <Panel on={f.onLeft} u0={0.12} v0={0.62} u1={0.88} v1={0.86} fill="var(--viz-screen)" />
                    <path d={`M${round(x)},${round(y)} c10,6 10,22 2,30`} fill="none" stroke="var(--viz-edge)" strokeWidth={2.2} strokeLinecap="round" />
                </>
            );
            break;
        }
        case "broker":
        case "cloud":
            detail = (
                <>
                    <Lines list={[0.25, 0.5, 0.75].map((v) => [f.onLeft(0.04, v), f.onLeft(0.96, v)])} />
                    <Leds on={f.onLeft} v={0.88} at={[0.15, 0.3]} />
                    <Leds on={f.onLeft} v={0.62} at={[0.15, 0.3]} />
                    <Leds on={f.onLeft} v={0.38} at={[0.15, 0.3]} />
                </>
            );
            break;
        case "building":
            detail = (
                <>
                    {[0.2, 0.45, 0.7].flatMap((v) => [0.12, 0.42, 0.72].map((u) => <Panel key={`l${u}${v}`} on={f.onLeft} u0={u} v0={v} u1={u + 0.16} v1={v + 0.14} fill="var(--viz-screen)" />))}
                    {[0.2, 0.45, 0.7].flatMap((v) => [0.15, 0.55].map((u) => <Panel key={`r${u}${v}`} on={f.onRight} u0={u} v0={v} u1={u + 0.22} v1={v + 0.14} fill="var(--viz-screen)" />))}
                </>
            );
            break;
        case "sensor": {
            const head: Box = { cx, cy, w: 16, d: 12, h: 10, z: size.h };
            return (
                <g>
                    <Solid box={box} active={active} />
                    <Solid box={head} active={active} />
                </g>
            );
        }
        case "radio": {
            const [x, y] = project(cx, cy, size.h);
            return (
                <g>
                    <Solid box={box} active={active} />
                    {[8, 14].map((r) => (
                        <path key={r} d={`M${round(x - r)},${round(y - 4)} a${r},${r} 0 0 1 ${2 * r},0`} fill="none" stroke={tone.edge} strokeWidth={1.4} />
                    ))}
                </g>
            );
        }
        case "pv": {
            // Three rows of panels, tilted towards the viewer
            const rows = [0, 1, 2].map((row) => {
                const x0 = cx - size.w / 2 + row * (size.w / 3);
                const x1 = x0 + size.w / 3 - 8;
                const [y0, y1] = [cy - size.d / 2, cy + size.d / 2];
                return points([x0, y0, size.h], [x1, y0, size.h], [x1, y1, 4], [x0, y1, 4]);
            });
            return (
                <g>
                    {rows.map((row) => (
                        <polygon key={row} points={row} fill="var(--viz-pv)" stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                    ))}
                </g>
            );
        }
        case "turbine": {
            const nacelle: Box = { cx, cy: cy - 6, w: 12, d: 22, h: 10, z: size.h - 4 };
            const [hx, hy] = project(cx, cy + 6, size.h + 1);
            return (
                <g>
                    <Solid box={box} active={active} />
                    <Solid box={nacelle} active={active} />
                    <g className="turbine-rotor" style={{ transformOrigin: `${round(hx)}px ${round(hy)}px` }}>
                        {[0, 120, 240].map((angle) => (
                            <path
                                key={angle}
                                d={`M${round(hx)},${round(hy)} l0,-40`}
                                transform={`rotate(${angle} ${round(hx)} ${round(hy)})`}
                                stroke={tone.edge}
                                strokeWidth={3}
                                strokeLinecap="round"
                            />
                        ))}
                    </g>
                    <circle cx={round(hx)} cy={round(hy)} r={3} fill={tone.top} stroke={tone.edge} />
                </g>
            );
        }
        case "car": {
            const body: Box = { cx, cy, w: size.w, d: size.d, h: 12, z: 5 };
            const cabin: Box = { cx: cx - 4, cy, w: 32, d: size.d - 4, h: 10, z: 17 };
            const b = faces(body);
            return (
                <g>
                    <Solid box={body} active={active} />
                    <Solid box={cabin} active={active} />
                    {[0.2, 0.8].map((u) => {
                        const [x, y] = b.onLeft(u, -0.15);
                        return <ellipse key={u} cx={round(x)} cy={round(y)} rx={6} ry={5} fill="var(--viz-screen)" />;
                    })}
                </g>
            );
        }
    }

    return (
        <g>
            <Solid box={box} active={active} />
            {detail}
        </g>
    );
}
