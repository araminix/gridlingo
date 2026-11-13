import type { DeviceKind } from "@/lessons/types";
import { faces, hull, project, round, type Box } from "./iso";

/** Each kind's footprint (w along x, d along y) and height, in plan units. */
const SIZE: Record<DeviceKind, { w: number; d: number; h: number }> = {
    scada: { w: 52, d: 40, h: 46 },
    rtu: { w: 28, d: 22, h: 62 },
    gateway: { w: 30, d: 22, h: 30 },
    relay: { w: 26, d: 20, h: 52 },
    breaker: { w: 24, d: 24, h: 44 },
    "merging-unit": { w: 24, d: 20, h: 22 },
    clock: { w: 26, d: 20, h: 33 },
    switch: { w: 44, d: 24, h: 28 },
    inverter: { w: 26, d: 20, h: 40 },
    pv: { w: 112, d: 52, h: 18 },
    battery: { w: 92, d: 34, h: 38 },
    turbine: { w: 8, d: 8, h: 130 },
    meter: { w: 18, d: 10, h: 30 },
    charger: { w: 16, d: 16, h: 52 },
    car: { w: 62, d: 28, h: 26 },
    broker: { w: 34, d: 30, h: 48 },
    cloud: { w: 40, d: 34, h: 56 },
    pmu: { w: 26, d: 20, h: 26 },
    building: { w: 60, d: 48, h: 86 },
    sensor: { w: 8, d: 8, h: 44 },
    laptop: { w: 30, d: 22, h: 30 },
    transformer: { w: 44, d: 30, h: 48 },
    controller: { w: 30, d: 22, h: 49 },
    radio: { w: 8, d: 8, h: 116 },
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

/** A PV array: three tables of panels side by side, each tilted toward the viewer (h at the back, 4 in front). */
function pvParts(cx: number, cy: number): Box[] {
    const { w, d, h } = SIZE.pv;
    return [0, 1, 2].map((row) => ({ cx: cx - w / 2 + row * (w / 3) + (w / 3 - 8) / 2, cy, w: w / 3 - 8, d, h }));
}

/** A wind turbine: a foundation, a round tower narrowing upward, and the nacelle on top, its rotor at the +y end. */
function turbineParts(cx: number, cy: number) {
    const top = SIZE.turbine.h - 4;
    return {
        pad: { cx, cy, w: 16, d: 16, h: 2 } satisfies Box,
        tower: { cx, cy, w: SIZE.turbine.w, d: SIZE.turbine.d, h: top } satisfies Box,
        nacelle: { cx, cy: cy - 6, w: 10, d: 24, h: 9, z: top } satisfies Box,
        hub: [cx, cy + 7, top + 4.5] as const,
    };
}

/** An EV charger: a slim pillar on a concrete base, capped on top. */
function chargerParts(cx: number, cy: number) {
    const { w, h } = SIZE.charger;
    return { base: { cx, cy, w: w + 4, d: 18, h: 2 } satisfies Box, pillar: { cx, cy, w, d: 12, h: h - 4, z: 2 } satisfies Box, cap: { cx, cy, w: w + 1.5, d: 13.5, h: 2, z: h - 2 } satisfies Box };
}

/** A meter on the front of an outdoor meter pillar. */
function meterParts(cx: number, cy: number) {
    const { w, d, h } = SIZE.meter;
    return { pillar: { cx, cy, w, d, h: h - 2 } satisfies Box, meter: { cx, cy: cy + d / 2 + 1.5, w: w - 6, d: 3, h: 15, z: 10 } satisfies Box, cap: { cx, cy, w: w + 2, d: d + 2, h: 2, z: h - 2 } satisfies Box };
}

/** An outdoor circuit breaker: a pad, a steel frame (two legs and a beam), one insulator column per phase on the beam,
 * and the operating mechanism's cabinet in front. */
function breakerParts(cx: number, cy: number) {
    const y = cy - 2;
    return {
        pad: { cx, cy, w: SIZE.breaker.w, d: SIZE.breaker.d, h: 1.5 } satisfies Box,
        legs: [-1, 1].map((at): Box => ({ cx: cx + at * 9, cy: y, w: 2.5, d: 2.5, h: 18, z: 1.5 })),
        beam: { cx, cy: y, w: 22, d: 4, h: 3, z: 18 } satisfies Box,
        poles: [-8.5, 0, 8.5].map((dx) => [cx + dx, y] as const),
        cabinet: { cx, cy: cy + 5, w: 12, d: 7, h: 14, z: 1.5 } satisfies Box,
    };
}

/** A power transformer: its tank on a pad, cooling fins in front, the tap changer's cabinet on its side, the oil
 * conservator lying front to back above its left end, and the HV bushings across the rest of its top. */
function transformerParts(cx: number, cy: number) {
    const { w, d } = SIZE.transformer;
    return {
        pad: { cx, cy, w, d, h: 1.5 } satisfies Box,
        tank: { cx, cy: cy - 2, w: 34, d: 18, h: 26, z: 1.5 } satisfies Box,
        fins: { cx, cy: cy + 10, w: 28, d: 6, h: 20, z: 3 } satisfies Box,
        tap: { cx: cx + 19, cy: cy - 2, w: 4, d: 8, h: 12, z: 6 } satisfies Box,
        conservator: { x: cx - 11, y0: cy - 10, y1: cy + 5, z: 34, r: 3.5 },
        hv: [-1, 7.5, 16].map((dx) => [cx + dx, cy - 2] as const),
    };
}

/** A network switch in a two-post rack: two posts on their feet joined at the top, a patch panel, the switch below it. */
function switchParts(cx: number, cy: number) {
    const { w, d, h } = SIZE.switch;
    const ends = [-1, 1].map((at) => cx + at * (w / 2 - 2));
    return {
        feet: ends.map((x): Box => ({ cx: x, cy, w: 4, d: d - 6, h: 1.5 })),
        posts: ends.map((x): Box => ({ cx: x, cy, w: 3, d: 3, h: h - 2, z: 1.5 })),
        bar: { cx, cy, w: w - 1, d: 3, h: 2, z: h - 2 } satisfies Box,
        panel: { cx, cy: cy + 1, w: w - 7, d: 4, h: 4, z: 18 } satisfies Box,
        unit: { cx, cy, w: w - 7, d: d - 6, h: 5, z: 10 } satisfies Box,
    };
}

/** A gateway as a rugged router: a box with cooling ribs on a small plinth, its two antennas rising at the back. */
function gatewayParts(cx: number, cy: number) {
    return { plinth: { cx, cy, w: SIZE.gateway.w, d: SIZE.gateway.d, h: 3 } satisfies Box, body: { cx, cy, w: 26, d: 18, h: 13, z: 3 } satisfies Box };
}

/** A controller's cabinet on a plinth, with a stack light (green, amber, red) standing on its roof. */
function controllerParts(cx: number, cy: number) {
    const { w, d } = SIZE.controller;
    return { plinth: { cx, cy, w, d, h: 3 } satisfies Box, body: { cx, cy, w, d, h: 36, z: 3 } satisfies Box, light: [cx + 9, cy - 6, 39] as const };
}

/** A PMU: a low cabinet on a plinth with the unit's chassis standing out from its front. */
function pmuParts(cx: number, cy: number) {
    const { w, d } = SIZE.pmu;
    return { plinth: { cx, cy, w, d, h: 3 } satisfies Box, body: { cx, cy, w, d, h: 18, z: 3 } satisfies Box, chassis: { cx, cy: cy + d / 2 + 0.75, w: w - 4, d: 1.5, h: 10, z: 8 } satisfies Box };
}

/** A merging unit: a rugged box mounted on a steel post out in the switchyard, the post on its foot plate. */
function mergingParts(cx: number, cy: number) {
    return {
        foot: { cx, cy: cy - 4, w: 10, d: 10, h: 1.5 } satisfies Box,
        post: { cx, cy: cy - 4, w: 3, d: 3, h: SIZE["merging-unit"].h, z: 1.5 } satisfies Box,
        unit: { cx, cy: cy + 1, w: 22, d: 9, h: 13, z: 8 } satisfies Box,
    };
}

/** A time server: a low cabinet on a plinth, the clock's chassis standing out from its front, a GPS antenna on a mast. */
function clockParts(cx: number, cy: number) {
    const { w, d } = SIZE.clock;
    return {
        plinth: { cx, cy, w, d, h: 3 } satisfies Box,
        body: { cx, cy, w, d, h: 14, z: 3 } satisfies Box,
        chassis: { cx, cy: cy + d / 2 + 0.75, w: w - 4, d: 1.5, h: 7, z: 8 } satisfies Box,
        mast: [cx + 7, cy - 6] as const,
    };
}

/** A server rack on its levelling plinth, under a roof cap. */
function rackParts(cx: number, cy: number) {
    const { w, d, h } = SIZE.broker;
    return { plinth: { cx, cy, w: w - 2, d: d - 2, h: 2 } satisfies Box, cabinet: { cx, cy, w: w - 4, d: d - 4, h: h - 4, z: 2 } satisfies Box, cap: { cx, cy, w: w - 3, d: d - 3, h: 2, z: h - 2 } satisfies Box };
}

/** A small data hall: a raised floor with two server racks on it; a cloud floats above (drawn, not a body). */
function hallParts(cx: number, cy: number) {
    const { w, d } = SIZE.cloud;
    return { floor: { cx, cy, w, d, h: 3 } satisfies Box, racks: [-1, 1].map((at): Box => ({ cx: cx + at * 9.5, cy: cy - 3, w: 17, d: 22, h: 30, z: 3 })) };
}

/** A building of six floors with a canopy over its door, and a cooling unit on its roof. */
function buildingParts(cx: number, cy: number) {
    const { w, d } = SIZE.building;
    return {
        body: { cx, cy, w, d, h: 80 } satisfies Box,
        canopy: { cx, cy: cy + d / 2 + 3, w: 18, d: 6, h: 1.5, z: 12 } satisfies Box,
        cooler: { cx: cx + 12, cy: cy - 10, w: 14, d: 10, h: 6, z: 80 } satisfies Box,
    };
}

/** A sensor mast: a slim pole on its foot plate, a small logger box on its front. */
function sensorParts(cx: number, cy: number) {
    return {
        foot: { cx, cy, w: SIZE.sensor.w, d: SIZE.sensor.d, h: 1.5 } satisfies Box,
        pole: { cx, cy, w: 2, d: 2, h: SIZE.sensor.h } satisfies Box,
        logger: { cx, cy: cy + 2.5, w: 6, d: 3, h: 7, z: 10 } satisfies Box,
    };
}

/** A laptop open on a folding field table: four legs, the top, the laptop's base and its lid tilted back. */
function laptopParts(cx: number, cy: number) {
    const { w, d } = SIZE.laptop;
    return {
        legs: [-1, 1].flatMap((ax) => [-1, 1].map((ay): Box => ({ cx: cx + ax * (w / 2 - 2), cy: cy + ay * (d / 2 - 2), w: 1.5, d: 1.5, h: 14 }))),
        top: { cx, cy, w, d, h: 1.5, z: 14 } satisfies Box,
        base: { cx, cy: cy + 1, w: 20, d: 13, h: 1.5, z: 15.5 } satisfies Box,
        // The lid's corners: from the base's back edge up to its top edge, leaning back
        lid: { x0: cx - 10, x1: cx + 10, back: cy - 5.5, z: 17, top: cy - 8, height: 30 },
    };
}

/** A radio mast: a square lattice tower on its foundation, narrowing upward, and a small equipment cabinet at its foot. */
function mastParts(cx: number, cy: number) {
    return {
        foundation: { cx, cy, w: 12, d: 12, h: 1.5 } satisfies Box,
        tower: { cx, cy, w: SIZE.radio.w, d: SIZE.radio.d, h: 104, z: 1.5 } satisfies Box,
        cabinet: { cx: cx + 7, cy: cy + 4, w: 6, d: 6, h: 9 } satisfies Box,
    };
}

/** A firewall in a short network cabinet on its plinth, under a cap. */
function firewallParts(cx: number, cy: number) {
    const { w, d, h } = SIZE.firewall;
    return { plinth: { cx, cy, w, d, h: 2 } satisfies Box, cabinet: { cx, cy, w: w - 2, d: d - 2, h: h - 4, z: 2 } satisfies Box, cap: { cx, cy, w: w - 1, d: d - 1, h: 2, z: h - 2 } satisfies Box };
}

/** A battery container on its concrete pad. */
function batteryParts(cx: number, cy: number) {
    const { w, d, h } = SIZE.battery;
    return { pad: { cx, cy, w: w + 4, d: d + 4, h: 2 } satisfies Box, container: { cx, cy, w, d, h: h - 4, z: 2 } satisfies Box };
}

/**
 * The boxes a device fills, standing on the ground at (cx, cy) (some raised by z): what casts its shadow, and what the
 * ground under a scene is sized from. Every part that reaches out on the ground must be here, or it can stand off the
 * edge of the home page's plate (a test checks every scene).
 */
export function bodyOf(kind: DeviceKind, cx: number, cy: number): Box[] {
    if (kind === "scada") {
        const { desk, screens } = scadaParts(cx, cy);
        return [desk, ...screens];
    }
    if (kind === "pv") return pvParts(cx, cy);
    if (kind === "firewall") {
        const { plinth, cabinet } = firewallParts(cx, cy);
        return [plinth, cabinet];
    }
    if (kind === "radio") {
        const { foundation, tower, cabinet } = mastParts(cx, cy);
        return [foundation, tower, cabinet];
    }
    if (kind === "laptop") {
        const { legs, top, lid } = laptopParts(cx, cy);
        return [...legs, top, { cx, cy: (lid.back + lid.top) / 2, w: lid.x1 - lid.x0, d: 3, h: lid.height - lid.z, z: lid.z }];
    }
    if (kind === "sensor") {
        const { foot, pole, logger } = sensorParts(cx, cy);
        return [foot, pole, logger];
    }
    if (kind === "building") {
        // The cooling unit's shadow falls on the roof, not on the ground
        const { body, canopy } = buildingParts(cx, cy);
        return [body, canopy];
    }
    if (kind === "cloud") {
        const { floor, racks } = hallParts(cx, cy);
        return [floor, ...racks];
    }
    if (kind === "broker") {
        const { plinth, cabinet } = rackParts(cx, cy);
        return [plinth, cabinet];
    }
    if (kind === "clock") {
        const { plinth, body, chassis } = clockParts(cx, cy);
        return [plinth, body, chassis];
    }
    if (kind === "merging-unit") {
        const { foot, post, unit } = mergingParts(cx, cy);
        return [foot, post, unit];
    }
    if (kind === "pmu") {
        const { plinth, body, chassis } = pmuParts(cx, cy);
        return [plinth, body, chassis];
    }
    if (kind === "controller") {
        const { plinth, body } = controllerParts(cx, cy);
        return [plinth, body];
    }
    if (kind === "gateway") {
        const { plinth, body } = gatewayParts(cx, cy);
        return [plinth, body];
    }
    if (kind === "switch") {
        const { feet, posts, bar, panel, unit } = switchParts(cx, cy);
        return [...feet, ...posts, bar, panel, unit];
    }
    if (kind === "transformer") {
        const { pad, tank, fins, tap, conservator: c } = transformerParts(cx, cy);
        return [pad, tank, fins, tap, { cx: c.x, cy: (c.y0 + c.y1) / 2, w: 2 * c.r, d: c.y1 - c.y0, h: 2 * c.r, z: c.z - c.r }];
    }
    if (kind === "breaker") {
        const { pad, beam, cabinet } = breakerParts(cx, cy);
        return [pad, { ...beam, h: 21, z: 0 }, cabinet, { ...beam, w: 20, h: 23, z: 21 }];
    }
    if (kind === "meter") {
        const { pillar, meter } = meterParts(cx, cy);
        return [pillar, meter];
    }
    if (kind === "charger") {
        const { base, pillar } = chargerParts(cx, cy);
        return [base, pillar];
    }
    if (kind === "turbine") {
        const { pad, tower, nacelle } = turbineParts(cx, cy);
        return [pad, tower, nacelle];
    }
    if (kind === "battery") {
        const { pad, container } = batteryParts(cx, cy);
        return [pad, container];
    }
    if (kind === "inverter") {
        const { body, posts } = inverterParts(cx, cy);
        return [...posts, body];
    }
    return [{ cx, cy, ...SIZE[kind] }];
}

/** How far a device spreads from its centre along x or y on the ground, from the boxes it fills. */
export function reachOf(kind: DeviceKind, axis: "x" | "y"): number {
    return Math.max(...bodyOf(kind, 0, 0).map((part) => (axis === "x" ? Math.abs(part.cx) + part.w / 2 : Math.abs(part.cy) + part.d / 2)));
}

/** How high a device reaches above the ground. */
export const heightOf = (kind: DeviceKind) => (kind === "turbine" ? SIZE.turbine.h + 44 : kind === "sensor" ? SIZE.sensor.h + 10 : SIZE[kind].h);

/** Where a device's label goes: above its highest point on the screen, the top's back corner, in perspective. */
export function labelAt(kind: DeviceKind, cx: number, cy: number): [number, number] {
    const { w, d } = SIZE[kind];
    const [x, y] = project(cx, cy, heightOf(kind));
    if (kind === "turbine") return [x, y - 6];
    if (kind === "sensor") return [x, y - 13];
    return [x, project(cx - w / 2, cy - d / 2, heightOf(kind))[1] - 6];
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

/** A porcelain insulator standing at (x, y) from z0 to z1: a core with round sheds of radius r stacked up it, a clamp for
 * the line on top. */
function Insulator({ at: [x, y], z0, z1, r, tone }: { at: readonly [number, number]; z0: number; z1: number; r: number; tone: ReturnType<typeof tones> }) {
    const [bx, by] = project(x, y, z0);
    const [tx, ty] = project(x, y, z1);
    const core = r * 0.48;
    const count = Math.max(2, Math.round((z1 - z0) / 4));
    return (
        <g>
            <polygon points={quad([bx - core, by], [tx - core, ty], [tx + core, ty], [bx + core, by])} fill={tone.left} stroke={tone.edge} strokeWidth={0.6} />
            {Array.from({ length: count }, (_, i) => {
                const [sx, sy] = project(x, y, z0 + ((i + 0.5) * (z1 - z0)) / count);
                return <ellipse key={i} cx={round(sx)} cy={round(sy)} rx={r} ry={round(r * 0.58)} fill={tone.top} stroke={tone.edge} strokeWidth={0.6} />;
            })}
            <Lines list={[[project(x, y - 3, z1 + 1), project(x, y + 3, z1 + 1)]]} stroke={tone.edge} width={1.6} />
        </g>
    );
}

/** Servers seen through a rack's open front (from v 0.25 up): dark inside, each with drive bays and two lights. */
function Servers({ on, count, tone }: { on: (u: number, v: number) => [number, number]; count: number; tone: ReturnType<typeof tones> }) {
    const slot = 0.65 / count;
    const rows = Array.from({ length: count }, (_, i) => 0.9 - (i + 1) * slot);
    return (
        <>
            <Panel on={on} u0={0.06} v0={0.03} u1={0.94} v1={0.97} fill="var(--viz-screen)" />
            {rows.map((v) => (
                <Panel key={v} on={on} u0={0.1} v0={v} u1={0.9} v1={v + slot * 0.77} fill={tone.left} />
            ))}
            <Lines list={rows.flatMap((v) => [0.16, 0.24, 0.32, 0.4, 0.48].map((u) => [on(u, v + slot * 0.15), on(u, v + slot * 0.62)]))} width={0.6} />
            {rows.flatMap((v, i) =>
                [0.74, 0.82].map((u, j) => {
                    const [x, y] = on(u, v + slot * 0.38);
                    return <circle key={`${v}${u}`} cx={round(x)} cy={round(y)} r={0.7} fill={i === 2 && j === 1 ? "var(--viz-token)" : "var(--viz-ok)"} />;
                }),
            )}
        </>
    );
}

/** A rectangle on a face: from (u0, v0) to (u1, v1) of the face. */
function Panel({ on, u0, v0, u1, v1, fill }: { on: (u: number, v: number) => [number, number]; u0: number; v0: number; u1: number; v1: number; fill: string }) {
    return <polygon points={quad(on(u0, v0), on(u1, v0), on(u1, v1), on(u0, v1))} fill={fill} />;
}

function Lines({ list, stroke = "var(--viz-edge)", width = 1 }: { list: [number, number][][]; stroke?: string; width?: number }) {
    return <path d={list.map((line) => line.map((p, i) => `${i ? "L" : "M"}${pair(p)}`).join(" ")).join(" ")} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
}

/** A device of its kind standing at (cx, cy) on the ground. */
export function DeviceShape({ kind, cx, cy, active = false }: { kind: DeviceKind; cx: number; cy: number; active?: boolean }) {
    const size = SIZE[kind];
    const tone = tones(active);

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
            // A dark keyboard and a touchpad on its base; on the screen, lines of a terminal
            const { legs, top, base, lid } = laptopParts(cx, cy);
            const keys = faces(base).onTop;
            const screen = (u: number, v: number) => project(lid.x0 + u * (lid.x1 - lid.x0), lid.back + v * (lid.top - lid.back), lid.z + v * (lid.height - lid.z));
            return (
                <g>
                    {legs.map((leg) => (
                        <Solid key={`${leg.cx}${leg.cy}`} box={leg} active={active} fine />
                    ))}
                    <Solid box={top} active={active} fine />
                    <Solid box={base} active={active} fine />
                    <polygon points={quad(keys(0.08, 0.08), keys(0.92, 0.08), keys(0.92, 0.55), keys(0.08, 0.55))} fill="var(--viz-screen)" />
                    <polygon points={quad(keys(0.38, 0.66), keys(0.62, 0.66), keys(0.62, 0.9), keys(0.38, 0.9))} fill={tone.right} stroke={tone.edge} strokeWidth={0.4} />
                    <polygon points={quad(screen(0, 0), screen(1, 0), screen(1, 1), screen(0, 1))} fill={tone.left} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                    <polygon points={quad(screen(0.06, 0.08), screen(0.94, 0.08), screen(0.94, 0.92), screen(0.06, 0.92))} fill="var(--viz-screen)" />
                    <Lines
                        list={[
                            [screen(0.14, 0.78), screen(0.6, 0.78)],
                            [screen(0.14, 0.62), screen(0.78, 0.62)],
                            [screen(0.14, 0.46), screen(0.5, 0.46)],
                            [screen(0.14, 0.3), screen(0.24, 0.3)],
                        ]}
                        stroke="var(--viz-ok)"
                        width={0.8}
                    />
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
        case "gateway": {
            // Four network ports, a SIM slot and two lights in front; ribs on top to shed heat
            const { plinth, body } = gatewayParts(cx, cy);
            const box = faces(body);
            const top = body.z + body.h;
            const antennas = [-1, 1].map((at): [[number, number], [number, number]] => [project(cx + at * 10, cy - 6, top), project(cx + at * 12, cy - 7, top + 13)]);
            return (
                <g>
                    <Solid box={plinth} active={active} fine />
                    <Solid box={body} active={active} />
                    <Lines list={[0.2, 0.35, 0.5, 0.65, 0.8].map((v) => [box.onTop(0.08, v), box.onTop(0.92, v)])} width={0.6} />
                    {[0.12, 0.25, 0.38, 0.51].map((u) => (
                        <Panel key={u} on={box.onLeft} u0={u} v0={0.28} u1={u + 0.09} v1={0.56} fill="var(--viz-screen)" />
                    ))}
                    <Lines list={[[box.onLeft(0.72, 0.4), box.onLeft(0.9, 0.4)]]} stroke="var(--viz-screen)" width={1} />
                    {[
                        [0.72, "var(--viz-ok)"],
                        [0.84, "var(--viz-token)"],
                    ].map(([u, fill]) => {
                        const [x, y] = box.onLeft(u as number, 0.78);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={0.9} fill={fill as string} />;
                    })}
                    <Lines list={antennas} stroke={tone.edge} width={1.8} />
                    {antennas.map(([base]) => (
                        <circle key={base[0]} cx={round(base[0])} cy={round(base[1])} r={1.4} fill={tone.top} stroke={tone.edge} strokeWidth={0.6} />
                    ))}
                </g>
            );
        }
        case "controller": {
            // On its door a touch screen (a small chart), the emergency stop on its yellow plate, two selector switches
            // and the handle; a filter fan on its side
            const { plinth, body, light } = controllerParts(cx, cy);
            const door = faces(body).onLeft;
            const side = faces(body).onRight;
            const dot = ([x, y]: [number, number], r: number, fill: string, key: string) => <circle key={key} cx={round(x)} cy={round(y)} r={r} fill={fill} stroke={tone.edge} strokeWidth={0.4} />;
            const [lx, ly] = project(...light);
            return (
                <g>
                    <Solid box={plinth} active={active} fine />
                    <Solid box={body} active={active} />
                    <Lines list={[[door(0.06, 0.04), door(0.94, 0.04), door(0.94, 0.96), door(0.06, 0.96), door(0.06, 0.04)]]} width={0.6} />
                    <Panel on={door} u0={0.2} v0={0.56} u1={0.8} v1={0.86} fill="var(--viz-screen)" />
                    <Lines list={[[door(0.26, 0.8), door(0.74, 0.8)]]} stroke="var(--viz-pv)" width={0.7} />
                    <Lines
                        list={[
                            [door(0.34, 0.6), door(0.34, 0.7)],
                            [door(0.48, 0.6), door(0.48, 0.75)],
                            [door(0.62, 0.6), door(0.62, 0.68)],
                        ]}
                        stroke="var(--viz-ok)"
                        width={2}
                    />
                    <Panel on={door} u0={0.18} v0={0.28} u1={0.36} v1={0.42} fill="var(--viz-token)" />
                    {dot(door(0.27, 0.35), 1.6, "var(--destructive)", "stop")}
                    {dot(door(0.52, 0.35), 1.1, tone.top, "a")}
                    {dot(door(0.66, 0.35), 1.1, tone.top, "b")}
                    <Lines list={[[door(0.86, 0.42), door(0.86, 0.52)]]} width={1.4} />
                    <Panel on={side} u0={0.3} v0={0.14} u1={0.7} v1={0.38} fill={tone.left} />
                    <Lines list={[0.2, 0.26, 0.32].map((v) => [side(0.34, v), side(0.66, v)])} width={0.5} />
                    {["var(--viz-ok)", "var(--viz-token)", "var(--destructive)"].map((fill, i) => (
                        <rect key={fill} x={round(lx - 1.6)} y={round(ly - 3.2 * (i + 1))} width={3.2} height={3.2} fill={fill} stroke={tone.edge} strokeWidth={0.4} />
                    ))}
                    <rect x={round(lx - 1.8)} y={round(ly - 10.6)} width={3.6} height={1} fill={tone.top} stroke={tone.edge} strokeWidth={0.4} />
                </g>
            );
        }
        case "pmu": {
            // Its screen shows the three phases as arrows a third of a turn apart; beside it the time inputs and lights;
            // a GPS antenna on its roof
            const { plinth, body, chassis } = pmuParts(cx, cy);
            const unit = faces(chassis).onLeft;
            const [ru, rv] = [3.2 / chassis.w, 3.2 / chassis.h];
            const at = (deg: number, k: number) => unit(0.25 + k * ru * Math.cos((deg * Math.PI) / 180), 0.52 + k * rv * Math.sin((deg * Math.PI) / 180));
            const dial = Array.from({ length: 13 }, (_, i) => at(i * 30, 1));
            const [gx, gy] = project(cx - 6, cy - 4, body.z + body.h);
            return (
                <g>
                    <Solid box={plinth} active={active} fine />
                    <Solid box={body} active={active} />
                    <Solid box={chassis} active={active} fine />
                    <Panel on={unit} u0={0.06} v0={0.12} u1={0.44} v1={0.92} fill="var(--viz-screen)" />
                    <Lines list={[dial]} stroke="var(--viz-pv)" width={0.5} />
                    {[
                        [90, "var(--destructive)"],
                        [210, "var(--viz-token)"],
                        [330, "var(--primary)"],
                    ].map(([deg, color]) => (
                        <Lines key={deg} list={[[at(0, 0), at(deg as number, 0.9)]]} stroke={color as string} width={0.9} />
                    ))}
                    {[0.56, 0.68, 0.8].map((u) => {
                        const [x, y] = unit(u, 0.36);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={1.1} fill={tone.top} stroke={tone.edge} strokeWidth={0.5} />;
                    })}
                    {[
                        [0.56, "var(--viz-ok)"],
                        [0.68, "var(--viz-token)"],
                    ].map(([u, fill]) => {
                        const [x, y] = unit(u as number, 0.74);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={0.8} fill={fill as string} />;
                    })}
                    <path d={`M${round(gx - 3)},${round(gy)} a3,2.4 0 0 1 6,0 Z`} fill={tone.top} stroke={tone.edge} strokeWidth={0.6} />
                    <ellipse cx={round(gx)} cy={round(gy)} rx={3} ry={1.2} fill={tone.right} stroke={tone.edge} strokeWidth={0.5} />
                </g>
            );
        }
        case "merging-unit": {
            // Copper wires from the instrument transformers come into its terminals; fibres leave its ports with the
            // samples
            const { foot, post, unit } = mergingParts(cx, cy);
            const front = faces(unit).onLeft;
            const x0 = unit.cx - unit.w / 2;
            const fibre = (u: number, color: string, out: number) => {
                const [a, b, c, d] = [front(u, 0.55), project(x0 + u * unit.w, cy + 9, 4), project(cx + out, cy + 9, 2), project(cx + out, cy + 7, 0)];
                return <path key={u} d={`M${pair(a)} C${pair(b)} ${pair(c)} ${pair(d)}`} fill="none" stroke={color} strokeWidth={1} />;
            };
            return (
                <g>
                    <Solid box={foot} active={active} fine />
                    <Solid box={post} active={active} fine />
                    <Lines list={[0.14, 0.24, 0.34, 0.44].map((u) => [front(u, 0), project(x0 + u * unit.w, cy + 6, 0)])} width={0.7} />
                    <Solid box={unit} active={active} />
                    <Panel on={front} u0={0.08} v0={0.52} u1={0.56} v1={0.76} fill={tone.right} />
                    <Lines list={[0.12, 0.2, 0.28, 0.36, 0.44, 0.52].map((u) => [front(u, 0.56), front(u, 0.72)])} stroke="var(--viz-token)" width={1.2} />
                    {[0.64, 0.71, 0.78, 0.85].map((u) => (
                        <Panel key={u} on={front} u0={u} v0={0.56} u1={u + 0.05} v1={0.72} fill="var(--viz-screen)" />
                    ))}
                    {[0.66, 0.74, 0.82].map((u) => {
                        const [x, y] = front(u, 0.88);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={0.7} fill="var(--viz-ok)" />;
                    })}
                    {fibre(0.665, "var(--viz-token)", 8)}
                    {fibre(0.735, "var(--primary)", 11)}
                </g>
            );
        }
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
            // The time in red digits, laid on the chassis' front by one matrix (one unit along it, one unit down it);
            // the lock and alarm lights beside it; the GPS antenna on its mast
            const { plinth, body, chassis, mast } = clockParts(cx, cy);
            const front = faces(chassis).onLeft;
            const [ox, oy] = front(0.08, 0.84);
            const [ax, ay] = front(0.08 + 1 / chassis.w, 0.84);
            const [bx, by] = front(0.08, 0.84 - 1 / chassis.h);
            const roof = body.z + body.h;
            const [tx, ty] = project(mast[0], mast[1], roof + 12);
            return (
                <g>
                    <Solid box={plinth} active={active} fine />
                    <Solid box={body} active={active} />
                    <Solid box={chassis} active={active} fine />
                    <Panel on={front} u0={0.05} v0={0.14} u1={0.74} v1={0.86} fill="var(--viz-screen)" />
                    <text transform={`matrix(${[ax - ox, ay - oy, bx - ox, by - oy, ox, oy].map(round).join(" ")})`} x={1.4} y={4} fontSize={4.2} fontFamily="var(--font-mono, monospace)" fill="var(--destructive)">
                        12:00
                    </text>
                    {[
                        [0.82, "var(--viz-ok)"],
                        [0.91, "var(--viz-token)"],
                    ].map(([u, fill]) => {
                        const [x, y] = front(u as number, 0.5);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={0.8} fill={fill as string} />;
                    })}
                    <Lines list={[[project(mast[0], mast[1], roof), project(mast[0], mast[1], roof + 11)]]} stroke={tone.edge} width={1.2} />
                    <path d={`M${round(tx - 3)},${round(ty)} a3,2.6 0 0 1 6,0 Z`} fill={tone.top} stroke={tone.edge} strokeWidth={0.6} />
                    <ellipse cx={round(tx)} cy={round(ty)} rx={3} ry={1.2} fill={tone.right} stroke={tone.edge} strokeWidth={0.5} />
                </g>
            );
        }
        case "switch": {
            // Two rows of ports, two fibre cages and link lights on the switch; patch cords loop down to it from the panel
            const { feet, posts, bar, panel, unit } = switchParts(cx, cy);
            const front = faces(unit).onLeft;
            const patch = faces(panel).onLeft;
            const row = (v: number) => `M${pair(front(0.07, v))} L${pair(front(0.7, v))}`;
            const cords = [
                [0.15, 0.2, "var(--primary)"],
                [0.32, 0.38, "var(--viz-token)"],
                [0.5, 0.56, "var(--viz-ok)"],
            ] as const;
            return (
                <g>
                    {feet.map((foot) => (
                        <Solid key={foot.cx} box={foot} active={active} fine />
                    ))}
                    <Solid box={posts[0]!} active={active} fine />
                    <Solid box={unit} active={active} />
                    <path d={`${row(0.68)} ${row(0.32)}`} stroke="var(--viz-screen)" strokeWidth={1.4} strokeDasharray="1.5 1" />
                    <Panel on={front} u0={0.76} v0={0.25} u1={0.83} v1={0.75} fill="var(--viz-screen)" />
                    <Panel on={front} u0={0.86} v0={0.25} u1={0.93} v1={0.75} fill="var(--viz-screen)" />
                    {[0.1, 0.22, 0.34, 0.52].map((u) => {
                        const [x, y] = front(u, 0.9);
                        return <circle key={u} cx={round(x)} cy={round(y)} r={0.6} fill="var(--viz-ok)" />;
                    })}
                    <Solid box={panel} active={active} fine />
                    <path d={`M${pair(patch(0.07, 0.5))} L${pair(patch(0.93, 0.5))}`} stroke="var(--viz-screen)" strokeWidth={1.2} strokeDasharray="1.2 1" />
                    {cords.map(([from, to, color]) => {
                        const [a, d] = [patch(from, 0.5), front(to, 0.68)];
                        const [b, c] = [project(unit.cx - unit.w / 2 + from * unit.w, cy + 13, 16), project(unit.cx - unit.w / 2 + to * unit.w, cy + 13, 14)];
                        return <path key={from} d={`M${pair(a)} C${pair(b)} ${pair(c)} ${pair(d)}`} fill="none" stroke={color} strokeWidth={0.9} />;
                    })}
                    <Solid box={posts[1]!} active={active} fine />
                    <Solid box={bar} active={active} fine />
                </g>
            );
        }
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
            const { pad, container: box } = batteryParts(cx, cy);
            const wall = faces(box).onLeft;
            const doors = faces(box).onRight;
            const coolers = [0.22, 0.6].map((u): Box => ({ cx: cx - size.w / 2 + u * size.w, cy: cy + size.d / 2 + 2, w: 13, d: 4, h: 15, z: 12 }));
            const [bx, by] = project(cx + size.w / 2 - 7, cy - size.d / 2 + 6, size.h - 1);
            return (
                <g>
                    <Solid box={pad} active={active} fine />
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
        case "firewall": {
            // Through its glass door a patch panel and the firewall itself: a brick wall on its bezel (what it is for),
            // its ports and two lights; vents on its side
            const { plinth, cabinet, cap } = firewallParts(cx, cy);
            const front = faces(cabinet).onLeft;
            const side = faces(cabinet).onRight;
            const row = (u0: number, u1: number, v: number, width: number) => <path d={`M${pair(front(u0, v))} L${pair(front(u1, v))}`} stroke="var(--viz-screen)" strokeWidth={width} strokeDasharray="1.4 0.9" />;
            return (
                <g>
                    <Solid box={plinth} active={active} fine />
                    <Solid box={cabinet} active={active} />
                    <Solid box={cap} active={active} fine />
                    <Panel on={front} u0={0.06} v0={0.06} u1={0.94} v1={0.94} fill="var(--viz-screen)" />
                    <Panel on={front} u0={0.1} v0={0.76} u1={0.9} v1={0.86} fill={tone.left} />
                    {row(0.14, 0.86, 0.81, 1.2)}
                    <Panel on={front} u0={0.1} v0={0.4} u1={0.9} v1={0.7} fill={tone.left} />
                    <Panel on={front} u0={0.1} v0={0.4} u1={0.34} v1={0.7} fill="var(--viz-alert)" />
                    <Lines
                        list={[
                            [front(0.1, 0.5), front(0.34, 0.5)],
                            [front(0.1, 0.6), front(0.34, 0.6)],
                            ...[0.18, 0.26].map((u) => [front(u, 0.4), front(u, 0.5)]),
                            ...[0.14, 0.22, 0.3].map((u) => [front(u, 0.5), front(u, 0.6)]),
                            ...[0.18, 0.26].map((u) => [front(u, 0.6), front(u, 0.7)]),
                        ]}
                        stroke={tone.top}
                        width={0.5}
                    />
                    {row(0.4, 0.76, 0.55, 1.6)}
                    {[0.62, 0.48].map((v) => {
                        const [x, y] = front(0.84, v);
                        return <circle key={v} cx={round(x)} cy={round(y)} r={0.7} fill="var(--viz-ok)" />;
                    })}
                    <Lines list={[0.4, 0.5, 0.6, 0.7].map((v) => [side(0.3, v), side(0.7, v)])} width={0.5} />
                </g>
            );
        }
        case "breaker": {
            // Each column is an insulator: a core with round sheds stacked up it, a clamp for the line on top
            const { pad, legs, beam, poles, cabinet } = breakerParts(cx, cy);
            const door = faces(cabinet).onLeft;
            return (
                <g>
                    <Solid box={pad} active={active} fine />
                    {legs.map((leg) => (
                        <Solid key={leg.cx} box={leg} active={active} fine />
                    ))}
                    <Solid box={beam} active={active} fine />
                    {poles.map((at) => (
                        <Insulator key={at[0]} at={at} z0={21} z1={42} r={3.1} tone={tone} />
                    ))}
                    <Solid box={cabinet} active={active} />
                    <Lines list={[[door(0.5, 0.08), door(0.5, 0.92)]]} width={0.6} />
                    <Panel on={door} u0={0.62} v0={0.58} u1={0.86} v1={0.78} fill="var(--viz-screen)" />
                </g>
            );
        }
        case "transformer": {
            // The conservator is a round tank lying along y on two short posts; its +y end faces the viewer
            const { pad, tank, fins, tap, conservator: c, hv } = transformerParts(cx, cy);
            const end = (y: number) =>
                Array.from({ length: 16 }, (_, i) => {
                    const a = (i * Math.PI) / 8;
                    return project(c.x + c.r * Math.cos(a), y, c.z + c.r * Math.sin(a));
                });
            const ring = (list: [number, number][]) => list.map(pair).join(" ");
            const grill = faces(fins);
            const door = faces(tap).onRight;
            return (
                <g>
                    <Solid box={pad} active={active} fine />
                    <Solid box={tank} active={active} />
                    {[c.y0 + 3, c.y1 - 3].map((y) => (
                        <Solid key={y} box={{ cx: c.x, cy: y, w: 1.5, d: 1.5, h: c.z - c.r - 27.5, z: 27.5 }} active={active} fine />
                    ))}
                    <polygon points={ring(hull([...end(c.y0), ...end(c.y1)]))} fill={tone.top} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                    <polygon points={ring(end(c.y1))} fill={tone.left} stroke={tone.edge} strokeWidth={0.8} />
                    {hv.map((at) => (
                        <Insulator key={at[0]} at={at} z0={27.5} z1={46} r={2.6} tone={tone} />
                    ))}
                    <Solid box={tap} active={active} fine />
                    <Lines list={[[door(0.5, 0.1), door(0.5, 0.9)]]} width={0.6} />
                    <Solid box={fins} active={active} />
                    <Lines list={Array.from({ length: 13 }, (_, i) => 0.04 + i * 0.077).flatMap((u) => [[grill.onLeft(u, 0.04), grill.onLeft(u, 0.96)], [grill.onTop(u, 0.1), grill.onTop(u, 0.9)]])} width={0.6} />
                </g>
            );
        }
        case "meter": {
            // The meter stands out from the pillar: its reading, the round optical port, the pulse light, and the cover
            // over its terminals below
            const { pillar, meter, cap } = meterParts(cx, cy);
            const face = faces(meter).onLeft;
            const [ox, oy] = face(0.32, 0.4);
            const [px, py] = face(0.72, 0.4);
            return (
                <g>
                    <Solid box={pillar} active={active} />
                    <Solid box={cap} active={active} fine />
                    <Solid box={meter} active={active} fine />
                    <Panel on={face} u0={0.14} v0={0.62} u1={0.86} v1={0.86} fill="var(--viz-screen)" />
                    <Lines list={[[face(0.24, 0.74), face(0.7, 0.74)]]} stroke="var(--viz-ok)" width={1.2} />
                    <circle cx={round(ox)} cy={round(oy)} r={1.5} fill="var(--viz-screen)" stroke={tone.edge} strokeWidth={0.5} />
                    <circle cx={round(px)} cy={round(py)} r={0.9} fill="var(--destructive)" />
                    <Lines list={[[face(0, 0.24), face(1, 0.24)]]} width={0.6} />
                </g>
            );
        }
        case "charger": {
            // In front a green light bar (free to use), a screen with the charge and a card reader; on its side the
            // plug rests in a holster, its cable hanging in a loop
            const { base, pillar, cap } = chargerParts(cx, cy);
            const front = faces(pillar).onLeft;
            const x1 = cx + pillar.w / 2;
            const holster: Box = { cx: x1 + 1.5, cy: cy + 3, w: 3, d: 4, h: 7, z: 20 };
            const [a, b, c, d] = [project(x1, cy - 4, 36), project(x1 + 14, cy - 3, -6), project(x1 + 12, cy + 9, 2), project(x1 + 2, cy + 3, 22)];
            const [rx, ry] = front(0.5, 0.48);
            return (
                <g>
                    <Solid box={base} active={active} fine />
                    <Solid box={pillar} active={active} />
                    <Solid box={cap} active={active} fine />
                    <Panel on={front} u0={0.15} v0={0.9} u1={0.85} v1={0.94} fill="var(--viz-ok)" />
                    <Panel on={front} u0={0.15} v0={0.62} u1={0.85} v1={0.84} fill="var(--viz-screen)" />
                    <Lines list={[[front(0.26, 0.72), front(0.6, 0.72)]]} stroke="var(--viz-ok)" width={1.6} />
                    <Panel on={front} u0={0.36} v0={0.42} u1={0.64} v1={0.54} fill={tone.right} />
                    <circle cx={round(rx)} cy={round(ry)} r={1.1} fill="none" stroke={tone.edge} strokeWidth={0.5} />
                    <path d={`M${pair(a)} C${pair(b)} ${pair(c)} ${pair(d)}`} fill="none" stroke="var(--viz-edge)" strokeWidth={2} strokeLinecap="round" />
                    <Solid box={holster} active={active} fine />
                </g>
            );
        }
        case "broker": {
            // Through its open front, five servers (drive bays and lights) over a UPS with its small screen; vents on its side
            const { plinth, cabinet, cap } = rackParts(cx, cy);
            const front = faces(cabinet).onLeft;
            const side = faces(cabinet).onRight;
            return (
                <g>
                    <Solid box={plinth} active={active} fine />
                    <Solid box={cabinet} active={active} />
                    <Solid box={cap} active={active} fine />
                    <Servers on={front} count={5} tone={tone} />
                    <Panel on={front} u0={0.1} v0={0.06} u1={0.9} v1={0.2} fill={tone.left} />
                    <Panel on={front} u0={0.6} v0={0.09} u1={0.82} v1={0.17} fill="var(--viz-screen)" />
                    <Lines list={[0.3, 0.4, 0.5, 0.6, 0.7].map((v) => [side(0.3, v), side(0.7, v)])} width={0.5} />
                </g>
            );
        }
        case "cloud": {
            // Two racks of servers on a tiled raised floor, and the cloud they stand for floating above, lit from the left
            const { floor, racks } = hallParts(cx, cy);
            const tiles = faces(floor).onTop;
            const [x, y] = project(cx, cy, 50);
            const puffs = (dx: number, dy: number) => `M${round(x - 15 + dx)},${round(y + 5 + dy)} a5,5 0 0 1 3,-9 a8,8 0 0 1 14,-4 a6.5,6.5 0 0 1 12,4 a5,5 0 0 1 1,9 Z`;
            return (
                <g>
                    <Solid box={floor} active={active} fine />
                    <Lines list={[0.25, 0.5, 0.75].flatMap((t) => [[tiles(t, 0.02), tiles(t, 0.98)], [tiles(0.02, t), tiles(0.98, t)]])} width={0.4} />
                    {racks.map((rack) => (
                        <g key={rack.cx}>
                            <Solid box={rack} active={active} />
                            <Servers on={faces(rack).onLeft} count={4} tone={tone} />
                        </g>
                    ))}
                    <path d={puffs(1.5, 1.5)} fill={tone.right} />
                    <path d={puffs(0, 0)} fill={tone.top} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                </g>
            );
        }
        case "building": {
            // A glass door under a canopy, five floors of window bands (a few lit), and on the roof its rim, a cooling
            // unit and two rows of solar panels
            const { body, canopy, cooler } = buildingParts(cx, cy);
            const box = faces(body);
            const floors = [0.2, 0.344, 0.488, 0.632, 0.776];
            const bands = (on: typeof box.onLeft, key: string, lit: number[]) =>
                floors.map((v, i) => (
                    <g key={`${key}${v}`}>
                        <Panel on={on} u0={0.06} v0={v + 0.03} u1={0.94} v1={v + 0.11} fill="var(--viz-pv)" />
                        {lit.includes(i) && <Panel on={on} u0={0.26} v0={v + 0.03} u1={0.42} v1={v + 0.11} fill="var(--viz-token)" />}
                        <Lines list={[0.2, 0.34, 0.48, 0.62, 0.76].map((u) => [on(u, v + 0.03), on(u, v + 0.11)])} width={0.5} />
                    </g>
                ));
            const [fx, fy] = faces(cooler).onTop(0.5, 0.5);
            const panels = [-14, -6].map((dy) => {
                const at = (x: number, y: number, z: number) => project(cx - 26 + x, cy + dy + y, 80 + z);
                return quad(at(0, 0, 3), at(22, 0, 3), at(22, 5, 0.5), at(0, 5, 0.5));
            });
            return (
                <g>
                    <Solid box={body} active={active} />
                    <Lines list={[[box.onTop(0.03, 0.03), box.onTop(0.97, 0.03), box.onTop(0.97, 0.97), box.onTop(0.03, 0.97), box.onTop(0.03, 0.03)]]} width={0.6} />
                    {bands(box.onLeft, "l", [1, 3])}
                    {bands(box.onRight, "r", [2])}
                    <Panel on={box.onLeft} u0={0.4} v0={0} u1={0.6} v1={0.13} fill="var(--viz-pv)" />
                    <Lines list={[[box.onLeft(0.5, 0), box.onLeft(0.5, 0.13)]]} width={0.6} />
                    <Solid box={canopy} active={active} fine />
                    {panels.map((points) => (
                        <polygon key={points} points={points} fill="var(--viz-cell)" stroke={tone.edge} strokeWidth={0.6} />
                    ))}
                    <Solid box={cooler} active={active} fine />
                    <ellipse cx={round(fx)} cy={round(fy)} rx={4} ry={2.3} fill={tone.right} stroke={tone.edge} strokeWidth={0.5} />
                </g>
            );
        }
        case "sensor": {
            // A weather mast: cups turning in the wind on top, the white discs that shade a thermometer, a small solar
            // panel, and the logger box sending it all by radio
            const { foot, pole, logger } = sensorParts(cx, cy);
            const top = SIZE.sensor.h + 2;
            const [hx, hy] = project(cx, cy, top);
            const arms = [0, 120, 240].map((deg) => project(cx + 6 * Math.cos((deg * Math.PI) / 180), cy + 6 * Math.sin((deg * Math.PI) / 180), top));
            const shield = [21, 23, 25, 27, 29].map((z) => project(cx + 5, cy, z));
            const panel = quad(project(cx - 7, cy - 3, 35), project(cx - 1.5, cy - 3, 35), project(cx - 1.5, cy + 2, 31), project(cx - 7, cy + 2, 31));
            const [ax, ay] = project(cx + 1.5, cy + 2.5, 17);
            return (
                <g>
                    <Solid box={foot} active={active} fine />
                    <Solid box={pole} active={active} fine />
                    <Lines list={[[project(cx, cy, 25), project(cx + 5, cy, 25)]]} stroke={tone.edge} width={0.8} />
                    {shield.map(([x, y], i) => (
                        <ellipse key={i} cx={round(x)} cy={round(y)} rx={3.6} ry={2} fill={tone.top} stroke={tone.edge} strokeWidth={0.5} />
                    ))}
                    <polygon points={panel} fill="var(--viz-cell)" stroke={tone.edge} strokeWidth={0.5} />
                    <Solid box={logger} active={active} fine />
                    <Lines list={[[[ax, ay], [ax, ay - 7]]]} stroke={tone.edge} width={0.9} />
                    <Lines list={[[project(cx, cy, SIZE.sensor.h), [hx, hy]], ...arms.map((arm) => [[hx, hy], arm] as [number, number][])]} stroke={tone.edge} width={0.8} />
                    {arms.map(([x, y]) => (
                        <circle key={x} cx={round(x)} cy={round(y)} r={1.4} fill={tone.top} stroke={tone.edge} strokeWidth={0.6} />
                    ))}
                </g>
            );
        }
        case "radio": {
            // Four legs narrowing upward, braced crosswise at every level (the back legs fainter); two panel antennas
            // near the top, a whip above them, and the red light that warns aircraft
            const { foundation, tower, cabinet } = mastParts(cx, cy);
            const top = tower.z + tower.h;
            const half = (z: number) => 4 - (2 * (z - tower.z)) / tower.h;
            const corner = (sx: number, sy: number, z: number) => project(cx + sx * half(z), cy + sy * half(z), z);
            const levels = Array.from({ length: 9 }, (_, i) => tower.z + (i * tower.h) / 8);
            const front: [number, number][][] = [];
            for (const [a, b] of [
                [[-1, 1], [1, 1]],
                [[1, -1], [1, 1]],
            ] as const)
                for (let i = 0; i < 8; i++) {
                    front.push([corner(a[0], a[1], levels[i]!), corner(b[0], b[1], levels[i + 1]!)], [corner(b[0], b[1], levels[i]!), corner(a[0], a[1], levels[i + 1]!)]);
                    front.push([corner(a[0], a[1], levels[i + 1]!), corner(b[0], b[1], levels[i + 1]!)]);
                }
            const leg = (sx: number, sy: number) => [corner(sx, sy, tower.z), corner(sx, sy, top)];
            const panels = [
                { cx: cx, cy: cy + 3, w: 4, d: 1.5, h: 10, z: top - 14 },
                { cx: cx + 3, cy: cy, w: 1.5, d: 4, h: 10, z: top - 14 },
            ] satisfies Box[];
            const [lx, ly] = project(cx, cy, top + 9);
            return (
                <g>
                    <Solid box={foundation} active={active} fine />
                    <Lines list={[leg(-1, -1), leg(1, -1), leg(-1, 1)]} stroke={tone.edge} width={0.5} />
                    <Lines list={front} stroke={tone.edge} width={0.6} />
                    <Lines list={[leg(1, 1), leg(-1, 1), leg(1, -1)]} stroke={tone.edge} width={1.2} />
                    {panels.map((panel) => (
                        <Solid key={panel.cx + panel.cy} box={panel} active={active} fine />
                    ))}
                    <Lines list={[[project(cx, cy, top), [lx, ly + 1.5]]]} stroke={tone.edge} width={0.9} />
                    <circle cx={round(lx)} cy={round(ly)} r={1.5} fill="var(--destructive)" stroke={tone.edge} strokeWidth={0.4} />
                    <Solid box={cabinet} active={active} fine />
                </g>
            );
        }
        case "pv": {
            // Each table stands on two tall posts at the back and two short ones in front; dark cells in light frames,
            // with a soft sheen of the sky across them
            const low = 4;
            return (
                <g>
                    {pvParts(cx, cy).map((table) => {
                        const [x0, y0] = [table.cx - table.w / 2, table.cy - table.d / 2];
                        // u along the table, v down its slope, from the back (0) to the front (1)
                        const at = (u: number, v: number) => project(x0 + u * table.w, y0 + v * table.d, table.h - v * (table.h - low));
                        const posts = [3, table.d - 3].flatMap((dy) =>
                            [3, table.w - 3].map((dx): Box => ({ cx: x0 + dx, cy: y0 + dy, w: 1.6, d: 1.6, h: table.h - (dy / table.d) * (table.h - low) })),
                        );
                        return (
                            <g key={table.cx}>
                                {posts.map((post) => (
                                    <Solid key={`${post.cx}${post.cy}`} box={post} active={active} fine />
                                ))}
                                <polygon points={quad(at(0, 0), at(1, 0), at(1, 1), at(0, 1))} fill="var(--viz-cell)" stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                                <Lines
                                    list={[
                                        [at(0.5, 0), at(0.5, 1)],
                                        ...[0.25, 0.5, 0.75].map((v) => [at(0, v), at(1, v)]),
                                    ]}
                                    stroke="var(--viz-cell-line)"
                                    width={0.7}
                                />
                                <polygon points={quad(at(0.55, 0), at(0.8, 0), at(0.45, 1), at(0.2, 1))} fill="#fff" fillOpacity={0.12} />
                            </g>
                        );
                    })}
                </g>
            );
        }
        case "turbine": {
            // The tower is round and narrows upward, lit on its left; the blades turn in the upright plane across the
            // nacelle (along x and z), drawn flat around the hub and laid into that plane by one matrix
            const { pad, tower, nacelle, hub } = turbineParts(cx, cy);
            const ring = (z: number, angle: number) => {
                const r = 5 - (z / tower.h) * 2.2;
                const a = (angle * Math.PI) / 180;
                return project(cx + r * Math.cos(a), cy + r * Math.sin(a), z);
            };
            const shell = (from: number, to: number) => quad(ring(2, from), ring(tower.h, from), ring(tower.h, to), ring(2, to));
            const [hx, hy] = project(...hub);
            const [ux, uy] = project(hub[0] + 1, hub[1], hub[2]);
            const [vx, vy] = project(hub[0], hub[1], hub[2] + 1);
            const plane = `matrix(${[ux - hx, uy - hy, vx - hx, vy - hy, hx, hy].map(round).join(" ")})`;
            const blade = "M-1.3,3 L-2.9,10 L-0.7,40 L0.4,40 L1.7,10 L1.3,3 Z";
            const door = quad(ring(3, 80), ring(11, 80), ring(11, 100), ring(3, 100));
            return (
                <g>
                    <Solid box={pad} active={active} fine />
                    <polygon points={shell(135, 45)} fill={tone.top} />
                    <polygon points={shell(45, -45)} fill={tone.right} />
                    <polygon points={shell(135, -45)} fill="none" stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                    <polygon points={door} fill={tone.left} stroke={tone.edge} strokeWidth={0.6} />
                    <Solid box={nacelle} active={active} />
                    <g transform={plane}>
                        <g className="turbine-rotor" style={{ transformOrigin: "0px 0px" }}>
                            {[0, 120, 240].map((angle) => (
                                <path key={angle} d={blade} transform={`rotate(${angle})`} fill={tone.top} stroke={tone.edge} strokeWidth={0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                            ))}
                        </g>
                        <circle r={3.2} fill={tone.top} stroke={tone.edge} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    </g>
                </g>
            );
        }
        case "car": {
            // The side profile (x along the car, z up), from the rear's foot to the front's, pulled across the car's
            // width: trunk, rear window, roof, windshield, hood and nose on top, then the near side with its windows,
            // round wheels, lights and the charge port (its ring green while charging)
            const [y0, y1] = [cy - size.d / 2, cy + size.d / 2];
            const at = (x: number, y: number, z: number) => project(cx + x, y, z);
            const profile: [number, number][] = [[-31, 5], [-31, 14], [-24, 16], [-14, 25], [6, 25], [16, 16], [29, 13], [31, 10], [31, 5]];
            const glass = new Set([2, 4]);
            const tops = profile.slice(1, -1).map(([xa, za], i) => {
                const [xb, zb] = profile[i + 2]!;
                const fill = glass.has(i + 1) ? "var(--viz-pv)" : i === 6 ? tone.right : tone.top;
                return <polygon key={i} points={quad(at(xa, y0, za), at(xb, y0, zb), at(xb, y1, zb), at(xa, y1, za))} fill={fill} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />;
            });
            const near = (list: [number, number][]) => list.map(([x, z]) => pair(at(x, y1, z))).join(" ");
            const wheel = (x: number, r: number) => near(Array.from({ length: 16 }, (_, i) => [x + r * Math.cos((i * Math.PI) / 8), 6 + r * Math.sin((i * Math.PI) / 8)]));
            const [px, py] = at(-26, y1, 14);
            return (
                <g>
                    {tops}
                    <polygon points={near(profile)} fill={tone.left} stroke={tone.edge} strokeWidth={tone.width} strokeLinejoin="round" />
                    <polygon points={near([[-22, 17], [-13, 23.5], [5, 23.5], [13, 17]])} fill="var(--viz-pv)" stroke={tone.edge} strokeWidth={0.6} />
                    <Lines list={[[at(-4, y1, 17), at(-4, y1, 23.5)], [at(-4, y1, 6), at(-4, y1, 16)]]} width={0.6} />
                    {[-19, 19].map((x) => (
                        <g key={x}>
                            <polygon points={wheel(x, 6)} fill="var(--viz-screen)" />
                            <polygon points={wheel(x, 3)} fill={tone.top} stroke={tone.edge} strokeWidth={0.5} />
                        </g>
                    ))}
                    <polygon points={near([[-31, 11], [-29, 11], [-29, 13.5], [-31, 13.5]])} fill="var(--destructive)" />
                    <polygon points={quad(at(31, y1 - 3, 9), at(31, y1 - 9, 9), at(30.4, y1 - 9, 11.2), at(30.4, y1 - 3, 11.2))} fill="var(--viz-token)" />
                    <circle cx={round(px)} cy={round(py)} r={1.4} fill="var(--viz-screen)" stroke="var(--viz-ok)" strokeWidth={0.8} />
                </g>
            );
        }
    }
}
