import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const framed = lesson.frames.filter((frame) => frame.fields?.length).map((frame) => frame.id);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
/** A frame without its 5 preamble bytes. */
const body = (id: string) => bytes(id).slice(5);
const float = (list: number[], at: number) => new DataView(Uint8Array.from(list.slice(at, at + 4)).buffer).getFloat32(0);
const round = (value: number) => Math.round(value * 1000) / 1000;
/** Where the byte count sits: after the delimiter, the address (1 or 5 bytes) and the command. */
const countAt = (frame: number[]) => (frame[0]! & 0x80 ? 7 : 3);

describe("the HART frames", () => {
    it.each(framed)("%s starts with 5 preamble bytes and ends with the XOR of the rest", (id) => {
        const list = bytes(id);
        expect(list.slice(0, 5)).toEqual([0xff, 0xff, 0xff, 0xff, 0xff]);
        const frame = body(id);
        expect(frame.slice(0, -1).reduce((check, byte) => check ^ byte, 0)).toBe(frame.at(-1));
    });

    it.each(framed)("%s has a byte count that covers what follows it, up to the check byte", (id) => {
        const frame = body(id);
        const at = countAt(frame);
        expect(frame[at]).toBe(frame.length - at - 2);
    });

    it("asks command 0 with the classic short frame", () => {
        expect(body("cmd0")).toEqual([0x02, 0x80, 0x00, 0x00, 0x82]);
    });

    it("uses the long address of device type 0x2213, ID 0x0A5E31, from the primary master", () => {
        for (const id of ["cmd3", "cmd3-res", "cmd40", "exit"]) {
            const address = body(id).slice(1, 6);
            expect(address[0]! >> 7, "primary master").toBe(1);
            expect(((address[0]! & 0x3f) << 8) | address[1]!, "device type").toBe(0x2213);
            expect((address[2]! << 16) | (address[3]! << 8) | address[4]!, "device ID").toBe(0x0a5e31);
        }
        expect(body("cmd3")[0]).toBe(0x82);
        expect(body("cmd3-res")[0]).toBe(0x86);
    });

    it("reads 15.04 mA and 27.6 bar (unit code 7), and the current matches the pressure on a 0–40 bar range", () => {
        const frame = body("cmd3-res");
        expect(frame.slice(8, 10), "response code and device status").toEqual([0, 0]);
        expect(round(float(frame, 10))).toBe(15.04);
        expect(frame[14]).toBe(7);
        expect(round(float(frame, 15))).toBe(27.6);
        expect(round(4 + (16 * 27.6) / 40)).toBe(15.04);
    });

    it("fixes the current at 12 mA, which reads as 20 bar, then sends 0 to leave", () => {
        expect(body("cmd40")[6]).toBe(40);
        expect(float(body("cmd40"), 8)).toBe(12);
        expect(((12 - 4) / 16) * 40).toBe(20);
        expect(float(body("exit"), 8)).toBe(0);
    });
});

describe("the delimiter breakdown", () => {
    it("is 0x82, bit 7 first", () => {
        expect(parseInt(lesson.anatomy![0]!.parts.map(([bits]) => bits).join(""), 2)).toBe(0x82);
    });
});

describe("the loop current chart", () => {
    it("draws 15.04 mA and 12 mA on a 4–20 mA scale", () => {
        const signal = lesson.timing!.tracks[0]!.signal!;
        expect(signal.map(([, level]) => round(4 + 16 * level))).toEqual([15.04, 12, 15.04]);
    });
});
