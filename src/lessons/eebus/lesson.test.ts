import { describe, expect, it } from "vitest";
import { readingOf } from "@/playground/pilot";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";
import limit from "./lpc-limit.json?raw";

const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);

describe("SHIP messages", () => {
    it("start with the init message, 00 00", () => {
        expect(bytes("init")).toEqual([0x00, 0x00]);
    });

    it("send the hello as a control message: one type byte, then JSON in UTF-8", () => {
        const [type, ...json] = bytes("hello");
        expect(type, "control").toBe(0x01);
        const hello = JSON.parse(new TextDecoder().decode(new Uint8Array(json))) as { connectionHello: Record<string, unknown>[] };
        // SHIP writes an object as a list of one-key objects
        expect(hello.connectionHello).toEqual([{ phase: "ready" }, { waiting: 60000 }]);
    });
});

describe("the LPC limit", () => {
    const { datagram } = JSON.parse(limit) as {
        datagram: {
            header: { addressDestination: { device: string }; cmdClassifier: string; ackRequest: boolean };
            payload: { cmd: { loadControlLimitListData: { loadControlLimitData: { isLimitActive: boolean; timePeriod: { endTime: string }; value: { number: number; scale: number } }[] } }[] };
        };
    };
    const data = datagram.payload.cmd[0]!.loadControlLimitListData.loadControlLimitData[0]!;

    it("is a write that asks for a result, to the wallbox of the anatomy", () => {
        expect(datagram.header.cmdClassifier).toBe("write");
        expect(datagram.header.ackRequest).toBe(true);
        expect(lesson.anatomy![0]!.parts.map(([text]) => text).join("")).toBe(datagram.header.addressDestination.device);
    });

    it("limits to 4200 W for 2 hours, at least the 4.2 kW §14a keeps", () => {
        expect(data.isLimitActive).toBe(true);
        expect(data.value.number * 10 ** data.value.scale).toBe(4200);
        expect(data.timePeriod.endTime).toBe("PT2H");
    });

    it("fits the 6 A the wallbox gives the car: 10 % duty cycle, about 4.1 kW on three phases at 230 V", () => {
        expect(readingOf(10)).toEqual({ kind: "current", amps: 6 });
        expect(6 * 3 * 230).toBeLessThanOrEqual(4200);
        expect((6 * 3 * 230) / 1000).toBeCloseTo(4.1, 1);
    });
});
