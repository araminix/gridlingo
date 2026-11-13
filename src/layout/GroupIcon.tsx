import { Cloud, Gauge, PlugZap, RadioTower, ShieldCheck, Sun, Zap, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import type { Group } from "@/lessons/types";
import { cn } from "@/lib/utils";

const ICONS: Record<Group, LucideIcon> = { substation: Zap, control: RadioTower, plant: Sun, ev: PlugZap, metering: Gauge, iot: Cloud, security: ShieldCheck };

/** Sets --g to the group's colour, for classes that use var(--g). */
export const groupVars = (group: Group) => ({ "--g": `var(--group-${group})` }) as CSSProperties;

/** The group's icon in a round, tinted badge. */
export function GroupIcon({ group, className }: { group: Group; className?: string }) {
    const Icon = ICONS[group];
    return (
        <span aria-hidden="true" style={groupVars(group)} className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-[color-mix(in_oklab,var(--g)_14%,transparent)] text-[var(--g)]", className)}>
            <Icon className="size-[55%]" />
        </span>
    );
}
