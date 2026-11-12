import type { ReactNode } from "react";
import type { DeviceKind } from "@/lessons/types";
import { faces, points, project, round, type Box } from "./iso";

/** Each kind's footprint (w along x, d along y) and height, in plan units. */
const SIZE: Record<DeviceKind, { w: number; d: number; h: number }> = {
    scada: { w: 52, d: 40, h: 46 },
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
    firewall: { w: 36, d: 22, h: 30 },
};

/**
 * A SCADA master as the operator's desk in a control room: a desk top on a side panel and a drawer unit, open below
 * with a panel at the back, two screens on stands at its back edge, and a keyboard.
 */
function scadaParts(cx: number, cy: number) {
    const { w, d } = SIZE.scada;
    const [x0, x1, y0] = [cx - w / 2, cx + w / 2, cy - d / 2];
    const desk: Box = { cx, cy, w, d, h: 24 };
    const top: Box = { cx, cy, w, d, h: 3, z: 21 };
    const side: Box = { cx: x0 + 1.5, cy, w: 3, d, h: 21 };
    const drawers: Box = { cx: x1 - 8, cy, w: 16, d, h: 21 };
    const back: Box = { cx: (x0 + 3 + x1 - 16) / 2, cy: y0 + 1.5, w: w - 19, d: 2, h: 15, z: 4 };
    const screens = [-1, 1].map((at): Box => ({ cx: cx + at * 12.75, cy: y0 + 5, w: 24, d: 2.5, h: 18, z: 29 }));
    const stands = screens.map((screen): Box => ({ cx: screen.cx, cy: screen.cy - 0.5, w: 5, d: 4, h: 5, z: 24 }));
    const keyboard: Box = { cx: cx - 6, cy: cy + 9, w: 20, d: 7, h: 1.2, z: 24 };
    return { desk, top, side, drawers, back, screens, stands, keyboard };
}

/** A PV inverter hung on a steel frame of two posts, its cables running down into the ground. */
function inverterParts(cx: number, cy: number) {
    const body: Box = { cx, cy: cy + 2, w: SIZE.inverter.w, d: 14, h: 28, z: 10 };
    const posts = [-1, 1].map((at): Box => ({ cx: cx + at * 10, cy: cy - 6.5, w: 2, d: 2, h: SIZE.inverter.h }));
    return { body, posts };
}

/** The boxes a device fills, standing on the ground at (cx, cy) (some raised by z): what casts its shadow. */
export function bodyOf(kind: DeviceKind, cx: number, cy: number): Box[] {
    if (kind === "scada") {
        const { desk, screens } = scadaParts(cx, cy);
        return [desk, ...screens];
    }
    if (kind === "inverter") {
        const { body, posts } = inverterParts(cx, cy);
        return [...posts, body];
    }
    return [{ cx, cy, ...SIZE[kind] }];
}

/** How high a device reaches above the ground. */
export const heightOf = (kind: DeviceKind) => (kind === "turbine" ? SIZE.turbine.h + 44 : kind === "radio" ? SIZE.radio.h + 12 : kind === "sensor" ? SIZE.sensor.h + 10 : SIZE[kind].h);

/** Where a device's label goes: above its highest point on the screen (the top's back corner). */
export function labelAt(kind: DeviceKind, cx: number, cy: number): [number, number] {
    const { w, d } = SIZE[kind];
    const [x, y] = project(cx, cy, heightOf(kind));
    return [x, y - (kind === "turbine" ? 0 : kind === "sensor" ? 7 : (w + d) / 4) - 6];
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

/** A box in the scene's light; `fine` draws its edges thinner, for small parts. */
function Solid({ box, active, fine = false }: { box: Box; active: boolean; fine?: boolean }) {
    const f = faces(box);
    const tone = tones(active);
    const width = fine ? tone.width * 0.6 : tone.width;
    return (
        <>
            <polygon points={f.left} fill={tone.left} stroke={tone.edge} strokeWidth={width} strokeLinejoin="round" />
            <polygon points={f.right} fill={tone.right} stroke={tone.edge} strokeWidth={width} strokeLinejoin="round" />
            <polygon points={f.top} fill={tone.top} stroke={tone.edge} strokeWidth={width} strokeLinejoin="round" />
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
        case "scada": {
            const { top, side, drawers, back, screens, stands, keyboard } = scadaParts(cx, cy);
            const unit = faces(drawers).onLeft;
            const [trend, mimic] = screens.map((screen) => faces(screen).onLeft);
            // One screen shows two values over time, the other the station's single line with its breakers
            const wave = (values: number[]) => values.map((v, i) => trend!(0.14 + (i * 0.72) / (values.length - 1), v));
            const bus = [mimic!(0.14, 0.72), mimic!(0.86, 0.72)];
            const feeders = [0.3, 0.5, 0.7].map((u) => [mimic!(u, 0.72), mimic!(u, 0.26)]);
            return (
                <g>
                    <Solid box={back} active={active} fine />
                    <Solid box={side} active={active} fine />
                    <Solid box={drawers} active={active} fine />
                    <Lines
                        list={[
                            [unit(0, 1 / 3), unit(1, 1 / 3)],
                            [unit(0, 2 / 3), unit(1, 2 / 3)],
                            ...[0.17, 0.5, 0.83].map((v) => [unit(0.38, v), unit(0.62, v)]),
                        ]}
                        width={0.8}
                    />
                    <Solid box={top} active={active} />
                    {stands.map((stand) => (
                        <Solid key={stand.cx} box={stand} active={active} fine />
                    ))}
                    {screens.map((screen) => (
                        <Solid key={screen.cx} box={screen} active={active} />
                    ))}
                    {screens.map((screen) => (
                        <Panel key={screen.cx} on={faces(screen).onLeft} u0={0.07} v0={0.12} u1={0.93} v1={0.9} fill="var(--viz-screen)" />
                    ))}
                    <Lines list={[wave([0.5, 0.62, 0.56, 0.7, 0.64, 0.76])]} stroke="var(--viz-token)" width={1.2} />
                    <Lines list={[wave([0.3, 0.34, 0.28, 0.4, 0.36, 0.42])]} stroke="var(--viz-ok)" width={1.2} />
                    <Lines list={[bus, ...feeders]} stroke="var(--viz-pv)" width={1} />
                    {[0.3, 0.5, 0.7].map((u, i) => {
                        const [x, y] = mimic!(u, 0.48);
                        return <rect key={u} x={round(x - 1.8)} y={round(y - 1.8)} width={3.6} height={3.6} fill={i === 2 ? "var(--viz-token)" : "var(--viz-ok)"} />;
                    })}
                    <Solid box={keyboard} active={active} fine />
                </g>
            );
        }
        case "laptop": {
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
        case "rtu": {
            // A steel cabinet on a plinth under a small roof; through the window in its door, the I/O cards in their rack
            const body: Box = { cx, cy, w: size.w, d: size.d, h: size.h - 6, z: 4 };
            const door = faces(body).onLeft;
            const side = faces(body).onRight;
            const cards = [0.26, 0.38, 0.5, 0.62, 0.74];
            const seam = [door(0.07, 0.05), door(0.93, 0.05), door(0.93, 0.95), door(0.07, 0.95), door(0.07, 0.05)];
            return (
                <g>
                    <Solid box={{ cx, cy, w: size.w, d: size.d, h: 4 }} active={active} fine />
                    <Solid box={body} active={active} />
                    <Solid box={{ cx, cy, w: size.w + 2.5, d: size.d + 2.5, h: 2, z: size.h - 2 }} active={active} fine />
                    <Lines list={[seam]} width={0.7} />
                    <Panel on={door} u0={0.18} v0={0.5} u1={0.82} v1={0.88} fill="var(--viz-screen)" />
                    <Lines list={cards.map((u) => [door(u, 0.54), door(u, 0.79)])} stroke="var(--viz-pv)" width={2} />
                    {cards.map((u, i) => {
                        const [x, y] = door(u, 0.84);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={1.1} fill={i === 3 ? "var(--viz-token)" : "var(--viz-ok)"} />;
                    })}
                    <Lines list={[[door(0.84, 0.34), door(0.84, 0.44)]]} width={1.6} />
                    <Lines list={[0.12, 0.17, 0.22].map((v) => [door(0.3, v), door(0.7, v)])} width={0.7} />
                    <Lines list={[0.72, 0.77, 0.82].map((v) => [side(0.25, v), side(0.75, v)])} width={0.7} />
                </g>
            );
        }
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
        case "relay": {
            // A relay panel: the relay's faceplate stands out from its front (screen, a column of lights with the trip
            // light on top, keys), and below it the close and open buttons and a row of test switches
            const body: Box = { cx, cy, w: size.w, d: size.d, h: size.h - 4, z: 4 };
            const plate: Box = { cx, cy: cy + size.d / 2 + 0.75, w: size.w - 6, d: 1.5, h: 22, z: 26 };
            const front = faces(body).onLeft;
            const relay = faces(plate).onLeft;
            const dot = ([x, y]: [number, number], r: number, fill: string, key: string | number) => <circle key={key} cx={round(x)} cy={round(y)} r={r} fill={fill} />;
            return (
                <g>
                    <Solid box={{ cx, cy, w: size.w, d: size.d, h: 4 }} active={active} fine />
                    <Solid box={body} active={active} />
                    <Solid box={plate} active={active} fine />
                    <Panel on={relay} u0={0.34} v0={0.52} u1={0.9} v1={0.88} fill="var(--viz-screen)" />
                    <Lines
                        list={[
                            [relay(0.42, 0.76), relay(0.8, 0.76)],
                            [relay(0.42, 0.64), relay(0.7, 0.64)],
                        ]}
                        stroke="var(--viz-ok)"
                        width={0.8}
                    />
                    {["var(--destructive)", "var(--viz-token)", "var(--viz-ok)", "var(--viz-ok)"].map((fill, i) => dot(relay(0.15, 0.85 - i * 0.15), 1.1, fill, `l${i}`))}
                    {[0.3, 0.14].flatMap((v) => [0.46, 0.62, 0.78].map((u) => dot(relay(u, v), 0.9, "var(--viz-edge)", `k${u}${v}`)))}
                    {dot(front(0.38, 0.36), 1.8, "var(--viz-ok)", "close")}
                    {dot(front(0.62, 0.36), 1.8, "var(--destructive)", "open")}
                    <Lines list={[0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map((u) => [front(u, 0.14), front(u, 0.24)])} width={1.6} />
                </g>
            );
        }
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
        case "inverter": {
            // Fins on its side to shed heat; in front a display and lights, and the yellow DC switch with its red handle
            const { body, posts } = inverterParts(cx, cy);
            const front = faces(body).onLeft;
            const fins = faces(body).onRight;
            const [kx, ky] = front(0.3, 0.24);
            const bottom = cy + 2 + 7;
            return (
                <g>
                    {posts.map((post) => (
                        <Solid key={post.cx} box={post} active={active} fine />
                    ))}
                    <Lines list={[-7, -2.5, 2, 6.5].map((dx) => [project(cx + dx, bottom - 2, 10), project(cx + dx, bottom - 2, 0)])} width={1.3} />
                    <Solid box={body} active={active} />
                    <Lines list={[0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88].map((u) => [fins(u, 0.1), fins(u, 0.9)])} width={1.1} />
                    <Panel on={front} u0={0.2} v0={0.6} u1={0.6} v1={0.84} fill="var(--viz-screen)" />
                    <Lines list={[[front(0.26, 0.72), front(0.52, 0.72)]]} stroke="var(--viz-ok)" width={0.8} />
                    {["var(--viz-ok)", "var(--viz-ok)", "var(--viz-token)"].map((fill, i) => {
                        const [x, y] = front(0.75, 0.8 - i * 0.1);
                        return <circle key={i} cx={round(x)} cy={round(y)} r={1} fill={fill} />;
                    })}
                    <circle cx={round(kx)} cy={round(ky)} r={2.8} fill="var(--viz-token)" stroke={tone.edge} strokeWidth={0.6} />
                    <Lines list={[[front(0.22, 0.24), front(0.38, 0.24)]]} stroke="var(--destructive)" width={1.6} />
                </g>
            );
        }
        case "battery": {
            // A battery container on a concrete pad: corrugated walls, double doors with lock bars at its end, two air
            // conditioners on its long side and a warning light on the roof
            const box: Box = { cx, cy, w: size.w, d: size.d, h: size.h - 4, z: 2 };
            const wall = faces(box).onLeft;
            const doors = faces(box).onRight;
            const coolers = [0.22, 0.6].map((u): Box => ({ cx: cx - size.w / 2 + u * size.w, cy: cy + size.d / 2 + 2, w: 13, d: 4, h: 15, z: 12 }));
            const [bx, by] = project(cx + size.w / 2 - 7, cy - size.d / 2 + 6, size.h - 1);
            return (
                <g>
                    <Solid box={{ cx, cy, w: size.w + 4, d: size.d + 4, h: 2 }} active={active} fine />
                    <Solid box={box} active={active} />
                    <Lines list={Array.from({ length: 23 }, (_, i) => 0.04 + i * 0.04).map((u) => [wall(u, 0.06), wall(u, 0.94)])} width={0.5} />
                    <Lines
                        list={[
                            [doors(0.5, 0.04), doors(0.5, 0.96)],
                            ...[0.18, 0.36, 0.64, 0.82].map((u) => [doors(u, 0.08), doors(u, 0.92)]),
                            ...[0.18, 0.36, 0.64, 0.82].map((u) => [doors(u, 0.46), doors(u + (u < 0.5 ? 0.07 : -0.07), 0.46)]),
                        ]}
                        width={0.8}
                    />
                    {coolers.map((cooler) => {
                        const [gx, gy] = faces(cooler).onLeft(0.5, 0.5);
                        return (
                            <g key={cooler.cx}>
                                <Solid box={cooler} active={active} fine />
                                <ellipse cx={round(gx)} cy={round(gy)} rx={4} ry={4.6} fill={tone.right} stroke={tone.edge} strokeWidth={0.6} />
                                <ellipse cx={round(gx)} cy={round(gy)} rx={1.4} ry={1.6} fill={tone.edge} />
                            </g>
                        );
                    })}
                    <rect x={round(bx - 1.6)} y={round(by - 3)} width={3.2} height={4} rx={1.2} fill="var(--viz-token)" stroke={tone.edge} strokeWidth={0.5} />
                </g>
            );
        }
        case "firewall":
            // A brick wall on its front
            detail = (
                <Lines
                    list={[
                        ...[0.33, 0.66].map((v) => [f.onLeft(0, v), f.onLeft(1, v)]),
                        ...[0.25, 0.5, 0.75].map((u) => [f.onLeft(u, 0), f.onLeft(u, 0.33)]),
                        ...[0.12, 0.38, 0.62, 0.88].map((u) => [f.onLeft(u, 0.33), f.onLeft(u, 0.66)]),
                        ...[0.25, 0.5, 0.75].map((u) => [f.onLeft(u, 0.66), f.onLeft(u, 1)]),
                    ]}
                    stroke="var(--viz-alert)"
                />
            );
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
