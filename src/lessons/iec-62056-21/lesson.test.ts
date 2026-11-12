import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const [SOH, STX, ETX, ACK] = [0x01, 0x02, 0x03, 0x06];
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const text = (list: readonly number[]) => String.fromCharCode(...list);
/** The block check character: XOR of every byte after the first SOH or STX, up to and including ETX. */
const bcc = (list: readonly number[]) => list.slice(1, list.indexOf(ETX) + 1).reduce((x, byte) => x ^ byte, 0);

describe("IEC 62056-21 messages", () => {
    it("are 7-bit ASCII, as 7E1 carries them", () => {
        for (const frame of lesson.frames) for (const byte of bytesOf(frame.fields!)) expect(byte, frame.id).toBeLessThan(0x80);
    });

    it("sign on with /?! and get /, a maker, a speed, a model and CR LF back", () => {
        for (const id of ["signon", "signon-2"]) expect(text(bytes(id))).toBe("/?!\r\n");
        for (const id of ["ident", "ident-2"]) expect(text(bytes(id))).toMatch(/^\/[A-Z]{3}[0-6][\x21-\x7e]{1,16}\r\n$/);
    });

    it("select the speed the meter offered, then readout or programming mode", () => {
        const offered = bytes("ident")[4];
        expect(bytes("ack-readout")).toEqual([ACK, 0x30, offered, 0x30, 0x0d, 0x0a]);
        expect(bytes("ack-program")).toEqual([ACK, 0x30, offered, 0x31, 0x0d, 0x0a]);
        expect(offered, "'5' = 9600 baud in mode C").toBe(0x35);
    });

    const checked = lesson.frames.filter((frame) => [SOH, STX].includes(bytesOf(frame.fields!)[0]!));
    it.each(checked.map((frame) => [frame.id, frame] as const))("%s ends with ETX and a BCC that matches", (_, frame) => {
        const list = bytesOf(frame.fields!);
        expect(list.at(-2), "ETX").toBe(ETX);
        expect(list.at(-1), "BCC").toBe(bcc(list));
    });

    it("read out lines whose tariffs add up to the total", () => {
        const list = bytes("data");
        const block = text(list.slice(1, list.indexOf(ETX)));
        expect(block.endsWith("!\r\n")).toBe(true);
        const lines = block.split("\r\n").filter((line) => line && line !== "!");
        const values = Object.fromEntries(
            lines.map((line) => {
                const [, address, value, unit] = line.match(/^(\d+\.\d+\.\d+)\((\d+\.\d+)\*(\w+)\)$/)!;
                expect(unit).toBe("kWh");
                return [address!, Number(value)];
            }),
        );
        expect(values).toEqual({ "1.8.0": 12345.678, "1.8.1": 8765.432, "1.8.2": 3580.246 });
        expect(values["1.8.1"]! + values["1.8.2"]!).toBeCloseTo(values["1.8.0"]!, 6);
    });

    it("ask for the password, send it, read 2.8.0 and break", () => {
        const command = (id: string) => text(bytes(id).slice(1, bytes(id).indexOf(ETX)));
        expect(command("p0")).toBe("P0\x02(87654321)");
        expect(command("p1")).toBe("P1\x02(18273645)");
        expect(bytes("ack-password")).toEqual([ACK]);
        expect(command("r1")).toBe("R1\x022.8.0()");
        expect(text(bytes("answer").slice(1, -2))).toBe("2.8.0(000123.456*kWh)");
        expect(bytes("b0")).toEqual([0x01, 0x42, 0x30, 0x03, 0x71]);
    });

    it("take apart a line that the readout really holds", () => {
        const [c, d, e, value, unit] = lesson.anatomy![0]!.parts.map(([part]) => part);
        expect(text(bytes("data"))).toContain(`${c}.${d}.${e}(${value}*${unit})`);
    });
});
