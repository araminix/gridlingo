import { describe, expect, it } from "vitest";
import { bytesOf, crc16Modbus } from "../bytes";
import { lesson } from "./lesson";
import line from "./line1.yaml?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const word = (data: number[], at: number) => (data[at]! << 8) | data[at + 1]!;
const ADDRESS: Record<string, number> = { inv1: 1, meter: 2, inv2: 3 };

describe("Modbus RTU frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s ends with the CRC-16 of its bytes, low byte first", (_, frame) => {
        const data = bytesOf(frame.fields!);
        const crc = crc16Modbus(data.slice(0, -2));
        expect(data.slice(-2)).toEqual([crc & 0xff, crc >> 8]);
    });

    it("are sent to, and answered by, the slave whose address they carry", () => {
        for (const frame of framed) {
            const slave = frame.from === "logger" ? frame.to : frame.from;
            const address = typeof slave === "string" ? ADDRESS[slave] : 0;
            expect(bytesOf(frame.fields!)[0], frame.id).toBe(address);
        }
    });

    it("answer a read with as many bytes as were asked for", () => {
        for (const [request, response] of [
            ["inv1-req", "inv1-resp"],
            ["meter-req", "meter-resp"],
            ["confirm-req", "confirm-resp"],
        ]) {
            const asked = word(bytes(request!), 4);
            const answer = bytes(response!);
            expect(answer[1]).toBe(bytes(request!)[1]);
            expect(answer[2], `${response} byte count`).toBe(asked * 2);
            expect(answer.length).toBe(3 + asked * 2 + 2);
        }
    });

    it("carry the values the text says", () => {
        const inverter = bytes("inv1-resp");
        expect(word(inverter, 3)).toBe(3250);
        expect(word(inverter, 5) / 10).toBe(230.4);
        const meter = bytes("meter-resp");
        expect(new DataView(new Uint8Array(meter.slice(3, 7)).buffer).getFloat32(0)).toBe(2871.5);
        expect(word(bytes("broadcast"), 2)).toBe(40201 - 40001);
        expect(word(bytes("broadcast"), 4)).toBe(60);
        expect(word(bytes("confirm-resp"), 3)).toBe(60);
    });

    it("repeat the unanswered request unchanged, and broadcast to every slave", () => {
        expect(bytes("inv2-retry")).toEqual(bytes("inv2-req"));
        const broadcast = lesson.frames.find((frame) => frame.id === "broadcast")!;
        expect(bytes("broadcast")[0]).toBe(0);
        expect([...broadcast.to].sort()).toEqual(Object.keys(ADDRESS).sort());
        expect(lesson.frames.some((frame) => frame.from !== "logger" && frame.step === "broadcast"), "nobody answers a broadcast").toBe(false);
        expect(lesson.frames.some((frame) => frame.from === "inv2"), "slave 3 never answers").toBe(false);
    });

    it("time the line as 9600 baud 8E1 does: 11 bits a character, 3.5 characters of silence", () => {
        const char = (11 / 9600) * 1000;
        const [logger, inverter, idle] = lesson.timing!.tracks;
        expect(logger!.signal![1]![0]).toBeCloseTo(8 * char, 2);
        expect(inverter!.signal![2]![0] - inverter!.signal![1]![0]).toBeCloseTo(9 * char, 2);
        expect(idle!.events![0]!.t).toBeCloseTo(8 * char + 3.5 * char, 1);
        expect(idle!.events![1]!.t).toBeCloseTo(inverter!.signal![2]![0] + 3.5 * char, 1);
    });

    it("match the logger's setup file", () => {
        expect(line).toContain("baud: 9600");
        expect(line).toContain("parity: even");
        expect(line).toContain("{ function: 4, address: 12, count: 2 }");
        expect(word(bytes("meter-req"), 2)).toBe(12);
    });
});
