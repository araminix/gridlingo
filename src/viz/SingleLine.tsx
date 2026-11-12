import type { SingleLine as Diagram, Step } from "@/lessons/types";
import type { Words } from "@/lessons/words";

const BUS = 140;
const STATION = 420;
const PROCESS = 362;

/** The state of the diagram at a step: the last state whose step is not later than it. */
export function stateAt(diagram: Diagram, steps: readonly Step[], current: number) {
    const order = (id: string) => steps.findIndex((step) => step.id === id);
    let found: Diagram["states"][number] | undefined;
    for (const state of diagram.states) if (order(state.step) <= current) found = state;
    return found ?? { step: steps[0]!.id };
}

/**
 * A busbar with its feeders, their breakers and current transformers, the relays beside them and the networks
 * below: drawn the way the IEC 60617 symbols are (a filled square is a closed breaker, a hollow one is open).
 */
export function SingleLine({ diagram, steps, current, words }: { diagram: Diagram; steps: readonly Step[]; current: number; words: Words }) {
    const state = stateAt(diagram, steps, current);
    const open = new Set(state.open ?? []);
    const hasProcess = diagram.ieds.some((ied) => ied.bus === "process");
    const n = diagram.feeders.length;
    const feederX = new Map(diagram.feeders.map((feeder, i) => [feeder.id, 90 + ((i + 0.5) * 700) / n]));

    // Where each box sits, and the bus it hangs from
    const boxes = new Map<string, { x: number; y: number; w: number; bus: number }>();
    for (const ied of diagram.ieds) {
        const fx = ied.feeder ? (feederX.get(ied.feeder) ?? 440) : 440;
        boxes.set(ied.id, ied.bus === "process" ? { x: fx + 14, y: 262, w: 86, bus: PROCESS } : { x: fx + 24, y: 200, w: 96, bus: STATION });
    }
    (diagram.extras ?? []).forEach((id, i, all) => boxes.set(id, { x: 110 + ((i + 0.5) * 660) / all.length - 60, y: 440, w: 120, bus: STATION }));

    const flow = state.flow;
    const source = flow ? boxes.get(flow.from) : undefined;
    const flowBus = source?.bus ?? STATION;
    const centre = (id: string) => {
        const box = boxes.get(id)!;
        return box.x + box.w / 2;
    };
    const reached = flow?.to.filter((id) => boxes.has(id)) ?? [];
    const span = source ? [centre(flow!.from), ...reached.map(centre)] : [];

    return (
        <div dir="ltr" className="overflow-x-auto">
            <svg viewBox="0 0 880 500" className="block h-auto w-full min-w-[620px]" role="img" aria-label={words.singleLine("title")}>
                <defs>
                    <marker id="sld-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 Z" fill="var(--primary)" />
                    </marker>
                </defs>
                {/* The grid connection, the transformer and the incoming breaker */}
                <path d="M440,4 L440,32 M440,88 L440,104 M440,120 L440,140" stroke="var(--viz-energized)" strokeWidth={2.5} />
                <circle cx={440} cy={48} r={16} fill="none" stroke="var(--viz-energized)" strokeWidth={2} />
                <circle cx={440} cy={72} r={16} fill="none" stroke="var(--viz-energized)" strokeWidth={2} />
                <rect x={432} y={104} width={16} height={16} fill="var(--viz-energized)" />
                <text x={466} y={64} className="fill-muted-foreground font-mono text-[11px]">
                    {words.singleLine("transformer")}
                </text>
                <path d={`M80,${BUS} L800,${BUS}`} stroke="var(--viz-energized)" strokeWidth={6} />
                <text x={84} y={BUS - 12} className="fill-foreground text-[12px] font-semibold">
                    {words.singleLine("bus")}
                </text>

                {diagram.feeders.map((feeder, index) => {
                    const x = feederX.get(feeder.id)!;
                    const isOpen = open.has(feeder.id);
                    const below = isOpen ? "var(--viz-dead)" : "var(--viz-energized)";
                    return (
                        <g key={feeder.id}>
                            <path d={`M${x},${BUS} L${x},176`} stroke="var(--viz-energized)" strokeWidth={2.5} />
                            <rect x={x - 8} y={176} width={16} height={16} fill={isOpen ? "var(--viz-ground)" : "var(--viz-energized)"} stroke={isOpen ? "var(--viz-alert)" : "var(--viz-energized)"} strokeWidth={2.5} />
                            <path d={`M${x},192 L${x},300`} stroke={below} strokeWidth={2.5} />
                            <circle cx={x} cy={222} r={7} fill="var(--viz-ground)" stroke={below} strokeWidth={2} />
                            <path d={`M${x - 8},300 L${x + 8},300 L${x},314 Z`} fill={below} />
                            <text x={x - 14} y={189} textAnchor="end" className={`font-mono text-[11px] ${isOpen ? "fill-[var(--viz-alert)] font-semibold" : "fill-foreground"}`}>
                                {isOpen ? `Q${index + 1} · ${words.singleLine("open")}` : `Q${index + 1}`}
                            </text>
                            <text x={x} y={334} textAnchor="middle" className="fill-muted-foreground text-[12px]">
                                {words.singleLine(feeder.id)}
                            </text>
                            {state.fault === feeder.id && (
                                <g>
                                    <path d={`M${x - 14},258 L${x + 4},266 L${x - 8},272 L${x + 14},284`} fill="none" stroke="var(--viz-alert)" strokeWidth={2.5} strokeLinejoin="round" />
                                    <text x={x - 18} y={290} textAnchor="end" className="fill-[var(--viz-alert)] font-mono text-[11px]">
                                        {words.singleLine("fault")}
                                    </text>
                                </g>
                            )}
                        </g>
                    );
                })}

                {/* The networks: the station bus, and the process bus when merging units are on it */}
                {hasProcess && (
                    <>
                        <path d={`M80,${PROCESS} L800,${PROCESS}`} stroke="var(--viz-link)" strokeWidth={4} />
                        <text x={84} y={PROCESS - 8} className="fill-muted-foreground font-mono text-[11px]">
                            {words.singleLine("process")}
                        </text>
                    </>
                )}
                <path d={`M80,${STATION} L800,${STATION}`} stroke="var(--viz-link)" strokeWidth={4} />
                <text x={84} y={STATION - 8} className="fill-muted-foreground font-mono text-[11px]">
                    {words.singleLine("station")}
                </text>

                {[...boxes].map(([id, box]) => {
                    const ied = diagram.ieds.find((item) => item.id === id);
                    const fx = ied?.feeder ? feederX.get(ied.feeder) : undefined;
                    const hot = flow && (flow.from === id || flow.to.includes(id));
                    const bottom = box.y + 34;
                    return (
                        <g key={id}>
                            {fx !== undefined && <path d={`M${fx + 7},222 L${box.x},${ied?.bus === "process" ? 278 : 222}`} stroke="var(--viz-edge)" strokeWidth={1.5} strokeDasharray="3 3" fill="none" />}
                            <path d={box.y > STATION ? `M${box.x + box.w / 2},${STATION} L${box.x + box.w / 2},${box.y}` : `M${box.x + box.w / 2},${bottom} L${box.x + box.w / 2},${box.bus}`} stroke="var(--viz-link)" strokeWidth={2} />
                            {hasProcess && ied?.bus === "station" && <path d={`M${box.x + box.w - 12},${bottom} L${box.x + box.w - 12},${PROCESS}`} stroke="var(--viz-link)" strokeWidth={2} />}
                            <rect x={box.x} y={box.y} width={box.w} height={34} rx={5} fill="var(--viz-top)" stroke={hot ? "var(--primary)" : "var(--viz-edge)"} strokeWidth={hot ? 2 : 1.2} />
                            <text x={box.x + box.w / 2} y={box.y + 21} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">
                                {words.device(id)}
                            </text>
                        </g>
                    );
                })}

                {flow && source && (
                    <g>
                        <path d={`M${centre(flow.from)},${source.y > STATION ? source.y : source.y + 34} L${centre(flow.from)},${flowBus}`} stroke="var(--primary)" strokeWidth={3} />
                        <path d={`M${Math.min(...span)},${flowBus} L${Math.max(...span)},${flowBus}`} stroke="var(--primary)" strokeWidth={3} />
                        {reached.map((id) => {
                            const box = boxes.get(id)!;
                            const toward = box.y > STATION ? box.y : box.y + 34;
                            const x = centre(id);
                            return <path key={id} d={`M${x},${flowBus} L${x},${toward + (toward > flowBus ? -4 : 4)}`} stroke="var(--primary)" strokeWidth={3} markerEnd="url(#sld-arrow)" />;
                        })}
                        <rect x={Math.min(...span) + 12} y={flowBus - 30} width={Math.max(150, flow.label.length * 6.8 + 16)} height={22} rx={4} fill="var(--accent)" stroke="var(--primary)" />
                        <text x={Math.min(...span) + 20} y={flowBus - 15} className="fill-primary font-mono text-[11px] font-semibold">
                            {flow.label}
                        </text>
                    </g>
                )}
            </svg>
        </div>
    );
}
