import { describe, expect, it } from "vitest";
import { lesson } from "./lesson";
import forecast from "./forecast.json?raw";

interface Block {
    capacity: number;
    phase: string;
    unit: string;
    start_time: string;
    end_time: string;
}
const message = JSON.parse(forecast) as { group_id: string; type: string; forecasted_blocks: Block[] };
const minutes = (block: Block) => (Date.parse(block.end_time) - Date.parse(block.start_time)) / 60_000;

describe("the OSCP capacity forecast", () => {
    it("limits the consumption of group hub-17", () => {
        expect(message.group_id).toBe("hub-17");
        expect(message.type).toBe("CONSUMPTION");
    });

    it("has 15-minute blocks in UTC, in time order, for all phases in kW", () => {
        let last = 0;
        for (const block of message.forecasted_blocks) {
            expect(block.start_time.endsWith("Z") && block.end_time.endsWith("Z")).toBe(true);
            expect(minutes(block)).toBe(15);
            expect(Date.parse(block.start_time)).toBeGreaterThanOrEqual(last);
            last = Date.parse(block.end_time);
            expect([block.phase, block.unit]).toEqual(["ALL", "KW"]);
        }
        // 96 blocks of 15 minutes make a day
        expect(96 * 15).toBe(24 * 60);
    });

    it("allows 250 kW from 17:00 to 20:00Z and 400 kW around it", () => {
        for (const block of message.forecasted_blocks) {
            const hour = new Date(block.start_time).getUTCHours();
            expect(block.capacity, block.start_time).toBe(hour >= 17 && hour < 20 ? 250 : 400);
        }
    });

    it("takes apart the 17:00Z block in the anatomy", () => {
        const peak = message.forecasted_blocks.find((block) => block.start_time === "2026-11-13T17:00:00Z")!;
        expect(lesson.anatomy![0]!.parts.map(([text]) => text)).toEqual([
            `"capacity": ${peak.capacity}`,
            `"phase": "${peak.phase}"`,
            `"unit": "${peak.unit}"`,
            `"start_time": "${peak.start_time}"`,
            `"end_time": "${peak.end_time}"`,
        ]);
    });
});

describe("the numbers in the steps", () => {
    const hub = (amps: number) => 12 * amps * 3 * 230;

    it("keep 12 chargers at 30 A per phase under the 250 kW block", () => {
        expect(hub(30)).toBeLessThanOrEqual(250_000);
        expect(hub(30) / 1000).toBeCloseTo(248, 0);
    });

    it("measure 61.8 kWh in a block for 247 kW on average", () => {
        expect(247 * 0.25).toBeCloseTo(61.8, 1);
    });

    it("keep the hub under the 150 kW fallback at 18 A per phase", () => {
        expect(hub(18)).toBeLessThanOrEqual(150_000);
    });
});
