import { describe, expect, it } from "vitest";
import { bytesOf, checksum8 } from "../bytes";
import { lesson } from "./lesson";
import settings from "./rtu-101.json?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);

/** The control field and the link address of an FT 1.2 frame, and the ASDU when it has one. */
function parts(frame: number[]) {
    if (frame[0] === 0x10) return { control: frame[1]!, address: frame[2]!, asdu: [] as number[] };
    return { control: frame[4]!, address: frame[5]!, asdu: frame.slice(6, -2) };
}

describe("IEC 101 frames", () => {
    it.each(framed.map((frame) => [frame.id, bytesOf(frame.fields!)] as const))("%s is a sound FT 1.2 frame", (_, frame) => {
        expect(frame.at(-1), "end").toBe(0x16);
        if (frame[0] === 0x10) {
            expect(frame).toHaveLength(5);
            expect(frame[3], "checksum").toBe(checksum8(frame.slice(1, 3)));
        } else {
            const length = frame[1]!;
            expect(frame.slice(0, 4), "68 L L 68").toEqual([0x68, length, length, 0x68]);
            expect(frame).toHaveLength(length + 6);
            expect(frame[4 + length], "checksum").toBe(checksum8(frame.slice(4, 4 + length)));
        }
        expect(parts(frame).address, "link address 1").toBe(1);
    });

    it("mark who starts a transfer: PRM 1 from SCADA, 0 from the RTU", () => {
        for (const frame of framed) expect(parts(bytesOf(frame.fields!)).control >> 6, frame.id).toBe(frame.from === "scada" ? 1 : 0);
    });

    it("flip the FCB with every counted request, starting at 1 after the reset", () => {
        const counted = framed.map((frame) => parts(bytesOf(frame.fields!)).control).filter((control) => control & 0x40 && control & 0x10);
        expect(counted.map((control) => (control >> 5) & 1)).toEqual([1, 0, 1, 0, 1, 0]);
        expect(parts(bytes("reset")).control & 0x1f, "the reset is not counted").toBe(0);
    });

    it("ask for class 1 exactly when the RTU's last answer had ACD set", () => {
        let acd = false;
        for (const frame of framed) {
            const { control } = parts(bytesOf(frame.fields!));
            if (frame.from === "rtu") acd = Boolean(control & 0x20);
            else if (frame.id !== "reset" && frame.id !== "gi-act") expect(control & 0x0f, `${frame.id}: class ${acd ? 1 : 2}`).toBe(acd ? 10 : 11);
        }
    });

    it("carry the breaker states and the time the text gives", () => {
        const states = parts(bytes("states")).asdu;
        expect(states.slice(0, 4), "type 3, two objects, cause 20, station 1").toEqual([3, 2, 20, 1]);
        expect([states[4]! | (states[5]! << 8), states[6], states[7]! | (states[8]! << 8), states[9]]).toEqual([2001, 2, 2002, 2]);

        const trip = parts(bytes("trip")).asdu;
        expect(trip.slice(0, 7), "type 31, spontaneous, IOA 2001, off").toEqual([31, 1, 3, 1, 0xd1, 0x07, 1]);
        const [ms0, ms1, minute, hour, day, month, year] = trip.slice(7);
        expect({ ms: ms0! | (ms1! << 8), minute, hour, day: day! & 0x1f, weekday: day! >> 5, month, year }).toEqual({ ms: 7280, minute: 41, hour: 10, day: 12, weekday: 4, month: 11, year: 26 });
        expect(new Date(Date.UTC(2026, 10, 12)).getUTCDay(), "12 November 2026 is a Thursday").toBe(4);
    });

    it("take apart the control bytes the frames send", () => {
        for (const [id, frame] of [["primary", "gi-act"], ["secondary", "gi-con"]] as const) {
            const anatomy = lesson.anatomy!.find((item) => item.id === id)!;
            expect(parseInt(anatomy.parts.map(([bits]) => bits).join(""), 2), id).toBe(parts(bytes(frame)).control);
        }
    });

    it("match the sample settings: addresses, sizes and point types", () => {
        const file = JSON.parse(settings);
        expect(file.line).toMatchObject({ baudRate: 9600, format: "8E1", mode: "unbalanced" });
        expect([file.linkAddress, file.commonAddress]).toEqual([1, 1]);
        expect(file.sizes).toEqual({ linkAddress: 1, cause: 1, commonAddress: 1, ioa: 2 });
        expect(file.points.map((point: { ioa: number; type: string }) => [point.ioa, point.type])).toEqual([
            [2001, "M_DP_NA_1"],
            [2002, "M_DP_NA_1"],
        ]);
    });
});
