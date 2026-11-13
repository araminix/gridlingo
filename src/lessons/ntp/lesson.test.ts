import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
/** A big-endian number of the bytes from..to. */
const number = (list: number[], from: number, to: number) => list.slice(from, to).reduce((value, byte) => value * 256 + byte, 0);
/** An NTP timestamp (32 bits of seconds since 1900, 32 of fraction) as seconds. */
const timestamp = (list: number[], at: number) => number(list, at, at + 4) + number(list, at + 4, at + 8) / 2 ** 32;
/** Seconds since 1900 for a time on 2026-11-12, UTC. */
const at = (hours: number, minutes: number, seconds: number) => Date.UTC(2026, 10, 12, hours, minutes, 0) / 1000 + 2_208_988_800 + seconds;
const MICROSECOND = 1e-6;

describe("NTP messages", () => {
    const request = bytes("request");
    const reply = bytes("reply");

    it("are 48 bytes, with LI, version and mode in the first byte", () => {
        for (const [message, mode] of [
            [request, 3],
            [reply, 4],
        ] as const) {
            expect(message).toHaveLength(48);
            expect(message[0]! >> 6, "LI 0").toBe(0);
            expect((message[0]! >> 3) & 7, "version 4").toBe(4);
            expect(message[0]! & 7, "mode").toBe(mode);
        }
    });

    it("leave everything but the transmit time empty in the SNTP request", () => {
        expect(request[2], "poll 2^6 s").toBe(6);
        expect([request[1], request[3], ...request.slice(4, 40)].every((byte) => byte === 0)).toBe(true);
        expect(timestamp(request, 40) - at(10, 41, 5.75), "t1 on the RTU's clock").toBeCloseTo(0, 6);
    });

    it("answer as a stratum 1 server locked to GPS, about 1 µs fine", () => {
        expect(reply[1], "stratum").toBe(1);
        expect(reply[2], "poll copied").toBe(request[2]);
        expect((reply[3]! << 24) >> 24, "precision, signed").toBe(-20);
        expect(number(reply, 4, 8), "root delay").toBe(0);
        expect(number(reply, 8, 12) / 65536, "root dispersion in seconds").toBeCloseTo(0.000153, 6);
        expect(String.fromCharCode(...reply.slice(12, 16)), "reference ID").toBe("GPS\0");
    });

    it("copy t1 back and give t2 and t3, after the clock was last set", () => {
        expect(reply.slice(24, 32), "origin = the request's transmit time").toEqual(request.slice(40, 48));
        const [reference, t2, t3] = [timestamp(reply, 16), timestamp(reply, 32), timestamp(reply, 40)];
        expect(reference).toBe(at(10, 41, 7));
        expect(Math.abs(t2 - at(10, 41, 7.2504))).toBeLessThan(MICROSECOND);
        expect(Math.abs(t3 - at(10, 41, 7.2505))).toBeLessThan(MICROSECOND);
        expect(reference).toBeLessThan(t2);
    });

    it("give the offset and the delay the lesson says, with t4 = t1 + 0.9 ms on the RTU's clock", () => {
        const t1 = timestamp(request, 40);
        const [t2, t3] = [timestamp(reply, 32), timestamp(reply, 40)];
        const t4 = t1 + 0.0009;
        expect(Math.abs((t2 - t1 + (t3 - t4)) / 2 - 1.5), "offset θ").toBeLessThan(MICROSECOND);
        expect(Math.abs(t4 - t1 - (t3 - t2) - 0.0008), "delay δ").toBeLessThan(MICROSECOND);
        // The timing chart draws the same moments, in ms of real time
        const events = Object.fromEntries(lesson.timing!.tracks.flatMap((track) => track.events!.map((event) => [event.label, event.t])));
        expect(events).toEqual({ t1: 0, t2: 0.4, t3: 0.5, t4: 0.9 });
        expect(Math.abs((t3 - t2) * 1000 - (events.t3! - events.t2!))).toBeLessThan(0.001);
    });

    it("take apart the reply's transmit time in the anatomy", () => {
        const parts = bytesOf(lesson.anatomy![0]!.parts);
        expect(parts).toEqual(reply.slice(40, 48));
        expect(number(parts, 0, 4)).toBe(4_003_468_867);
    });
});
