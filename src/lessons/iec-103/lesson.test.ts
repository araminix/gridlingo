import { describe, expect, it } from "vitest";
import { bytesOf, checksum8 } from "../bytes";
import { lesson } from "./lesson";
import pointList from "./relay-f12-103.json?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
/** The user data of a frame: C, A and the ASDU. */
const userData = (frame: number[]) => (frame[0] === 0x10 ? frame.slice(1, 3) : frame.slice(4, -2));
/** The ASDU of a variable-length frame, after C and A. */
const asdu = (id: string) => bytes(id).slice(6, -2);

describe("IEC 103 frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s is a sound FT 1.2 frame with a checksum that matches", (_, frame) => {
        const all = bytesOf(frame.fields!);
        expect(all.at(-1), "end").toBe(0x16);
        if (all[0] === 0x10) {
            expect(all).toHaveLength(5);
        } else {
            expect(all[0]).toBe(0x68);
            expect(all[3]).toBe(0x68);
            expect(all[1], "the length twice").toBe(all[2]);
            expect(all[1], "L counts C, A and the ASDU").toBe(all.length - 6);
        }
        expect(all.at(-2), "checksum").toBe(checksum8(userData(all)));
        expect(userData(all)[1], "link address 12").toBe(12);
    });

    it("send requests from the controller and answers from the relay, with PRM set the right way", () => {
        for (const frame of framed) {
            const control = userData(bytesOf(frame.fields!))[0]!;
            expect(Boolean(control & 0x40), `${frame.id} PRM`).toBe(frame.from === "controller");
        }
    });

    it("flip FCB with every request that has FCV, starting at 1 after the reset", () => {
        const counted = framed.map((frame) => userData(bytesOf(frame.fields!))[0]!).filter((control) => control & 0x40 && control & 0x10);
        expect(counted.map((control) => (control >> 5) & 1)).toEqual([1, 0, 1, 0, 1, 0]);
        expect(userData(bytes("reset-cu"))[0]! & 0x0f, "reset CU is function 0").toBe(0);
    });

    it("set ACD exactly when class 1 data is waiting, and fetch it next", () => {
        const answers = framed.filter((frame) => frame.from === "relay");
        const acd = answers.map((frame) => [frame.id, (userData(bytesOf(frame.fields!))[0]! >> 5) & 1]);
        expect(acd).toEqual([
            ["ack-reset", 1],
            ["ident", 0],
            ["ack-gi", 1],
            ["gi-status", 1],
            ["gi-end", 0],
            ["measurands", 1],
            ["trip", 0],
        ]);
        // After each answer with ACD = 1 the controller asks for class 1 (function 10)
        for (const [id] of acd.filter(([, bit]) => bit === 1)) {
            const next = framed[framed.findIndex((frame) => frame.id === id) + 1]!;
            expect(userData(bytesOf(next.fields!))[0]! & 0x0f, `after ${id}`).toBe(10);
        }
    });

    it("carry the ASDUs the text describes", () => {
        const ident = asdu("ident");
        expect(ident.slice(0, 7)).toEqual([5, 0x81, 4, 12, 160, 3, 2]);
        expect(String.fromCharCode(...ident.slice(7, 15))).toBe("EXAMPLE ");
        expect(String.fromCharCode(...ident.slice(15))).toBe("V2.1");

        expect(asdu("gi")).toEqual([7, 0x81, 9, 12, 255, 0, 33]);
        expect(asdu("gi-end")).toEqual([8, 0x81, 10, 12, 255, 0, 33]);
        expect(asdu("gi-status").at(-1), "SIN carries the scan number").toBe(33);
        expect(asdu("gi-status").slice(0, 7)).toEqual([1, 0x81, 9, 12, 160, 18, 2]);

        const trip = asdu("trip");
        expect(trip.slice(0, 7)).toEqual([2, 0x81, 1, 12, 160, 68, 2]);
        expect(trip[7]! | (trip[8]! << 8), "relative time, ms").toBe(43);
        expect(trip[9]! | (trip[10]! << 8), "fault number").toBe(18);
    });

    it("tag events with CP32Time2a times that decode to what the text says", () => {
        const time = (data: number[]) => {
            const ms = data[0]! | (data[1]! << 8);
            return [data[3]! & 0x1f, data[2]! & 0x3f, ms / 1000, data[2]! >> 7, data[3]! >> 7];
        };
        expect(time(asdu("gi-status").slice(7, 11))).toEqual([10, 40, 11.792, 0, 0]);
        expect(time(asdu("trip").slice(11, 15))).toEqual([10, 41, 7.283, 0, 0]);
    });

    it("send measurands of 13 bits, where 4096 means 2.4 times the rated value", () => {
        const data = asdu("measurands");
        expect(data.slice(0, 6)).toEqual([9, 9, 2, 12, 160, 148]);
        const values = [];
        for (let i = 6; i < data.length; i += 2) {
            const word = (data[i]! | (data[i + 1]! << 8)) << 16 >> 16;
            expect(word & 0x07, "no flag set").toBe(0);
            values.push(((word >> 3) / 4096) * 2.4);
        }
        expect(values).toHaveLength(9);
        expect(values.slice(0, 3)).toEqual([0, 0, 0]);
        expect(values.slice(3, 6).map((value) => value.toFixed(3))).toEqual(["1.002", "0.998", "1.001"]);
        expect(values.slice(6, 8)).toEqual([0, 0]);
        expect((values[8]! * 50).toFixed(2)).toBe("50.01");
    });

    it("explain the lines of a point list that matches the frames", () => {
        const list = JSON.parse(pointList);
        expect(list.linkAddress).toBe(12);
        expect(list.functionType).toBe(160);
        expect(list.points.map((point: { inf: number; type: number }) => [point.inf, point.type])).toEqual([
            [18, 1],
            [68, 2],
            [148, 9],
        ]);
        const lines = pointList.split("\n");
        const notes = lesson.playground!.find((item) => item.kind === "file")!;
        if (notes.kind !== "file") throw new Error("no file");
        expect(lines[2]).toContain("linkAddress");
        expect(lines[5]).toContain("functionType");
        expect(lines[6]).toContain("measurandFullScale");
        expect(lines[10]).toContain("148");
        expect(Object.keys(notes.notes).map(Number).every((line) => lines[line - 1]?.trim())).toBe(true);
    });
});
