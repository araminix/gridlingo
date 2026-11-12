import { describe, expect, it } from "vitest";
import { bytesOf, checksum8 } from "../bytes";
import { lesson } from "./lesson";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const bytes = (id: string) => bytesOf(frame(id).fields!);

/** BCD digits, low byte first, as a number. */
const bcd = (list: readonly number[]) => Number([...list].reverse().map((byte) => byte.toString(16).padStart(2, "0")).join(""));
/** A little-endian unsigned integer. */
const uint = (list: readonly number[]) => list.reduceRight((value, byte) => value * 256 + byte, 0);
/** The maker's three letters from its two bytes. */
const maker = (list: readonly number[]) => {
    const code = uint(list);
    return [code >> 10, (code >> 5) & 31, code & 31].map((letter) => String.fromCharCode(64 + letter)).join("");
};

/** The data records after the 12-byte fixed header: DIF, VIF and the value, until a special DIF (0x0F, 0x1F) or the end. */
function records(user: readonly number[]) {
    const sizes: Record<number, number> = { 0x02: 2, 0x04: 4, 0x0a: 2, 0x0c: 4 };
    const list: { dif: number; vif: number; storage: number; data: number[] }[] = [];
    let at = 15;
    while (at < user.length) {
        const dif = user[at]!;
        if ((dif & 0x0f) === 0x0f) return { list, more: dif === 0x1f };
        const size = sizes[dif & 0x0f];
        expect(size, `data field of DIF ${dif.toString(16)}`).toBeDefined();
        expect(dif & 0x80, "no DIFE").toBe(0);
        const vif = user[at + 1]!;
        list.push({ dif, vif, storage: (dif >> 6) & 1, data: user.slice(at + 2, at + 2 + size!) });
        at += 2 + size!;
    }
    expect(at).toBe(user.length);
    return { list, more: false };
}

describe("M-Bus frames", () => {
    const shorts = lesson.frames.filter((item) => bytesOf(item.fields ?? [])[0] === 0x10);
    it.each(shorts.map((item) => [item.id, item] as const))("%s is a short frame with the sum of C and A", (_, item) => {
        const [start, c, a, cs, stop] = bytesOf(item.fields!);
        expect([start, stop]).toEqual([0x10, 0x16]);
        expect(cs).toBe(checksum8([c!, a!]));
        expect(a, "primary address 5").toBe(5);
    });

    const longs = lesson.frames.filter((item) => bytesOf(item.fields ?? [])[0] === 0x68);
    it.each(longs.map((item) => [item.id, item] as const))("%s is a long frame whose length and checksum add up", (_, item) => {
        const list = bytesOf(item.fields!);
        expect([list[0], list[3], list.at(-1)]).toEqual([0x68, 0x68, 0x16]);
        expect(list[1]).toBe(list[2]);
        const user = list.slice(4, -2);
        expect(list[1], "L counts C to the last data byte").toBe(user.length);
        expect(list.at(-2), "checksum").toBe(checksum8(user));
        expect(user.slice(0, 3), "RSP_UD from address 5, CI 0x72").toEqual([0x08, 0x05, 0x72]);
    });

    it("answer with a header that decodes to ID 12345678, maker EXA, a heat meter", () => {
        for (const id of ["rsp-1", "rsp-2"]) {
            const user = bytes(id).slice(4, -2);
            expect(bcd(user.slice(3, 7))).toBe(12345678);
            expect(maker(user.slice(7, 9))).toBe("EXA");
            expect(user[10], "medium: heat (outlet)").toBe(0x04);
            expect(user.slice(12, 15), "status and signature").toEqual([0, 0, 0]);
        }
        expect(bytes("rsp-2")[15], "access number").toBe(bytes("rsp-1")[15]! + 1);
    });

    it("carry the values the lesson tells, with the units of their VIFs", () => {
        const first = records(bytes("rsp-1").slice(4, -2));
        expect(first.more, "0x1F: more in the next telegram").toBe(true);
        const [energy, volume, flow, back, now] = first.list;
        expect([energy!.dif, energy!.vif, bcd(energy!.data)]).toEqual([0x0c, 0x06, 12345]);
        expect([volume!.vif, bcd(volume!.data) / 100]).toEqual([0x14, 456.78]);
        expect([flow!.dif, flow!.vif, bcd(flow!.data) / 10]).toEqual([0x0a, 0x5a, 70.2]);
        expect([back!.vif, bcd(back!.data) / 10]).toEqual([0x5e, 45.3]);
        // Type F: minute, hour, day and month in their bits; the year split in two
        const [minute, hour, day, month] = now!.data as [number, number, number, number];
        expect([now!.dif, now!.vif]).toEqual([0x04, 0x6d]);
        expect([2000 + (((day & 0xe0) >> 5) | ((month & 0xf0) >> 1)), month & 0x0f, day & 0x1f, hour & 0x1f, minute & 0x3f]).toEqual([2026, 11, 12, 8, 15]);

        const second = records(bytes("rsp-2").slice(4, -2));
        expect(second.more).toBe(false);
        const [date, dueEnergy, dueVolume] = second.list;
        expect(second.list.map((record) => record.storage), "all stored on the due date").toEqual([1, 1, 1]);
        const [low, high] = date!.data as [number, number];
        expect([date!.vif, 2000 + (((low & 0xe0) >> 5) | ((high & 0xf0) >> 1)), high & 0x0f, low & 0x1f]).toEqual([0x6c, 2025, 12, 31]);
        expect([dueEnergy!.vif, bcd(dueEnergy!.data)]).toEqual([0x06, 9876]);
        expect([dueVolume!.vif, bcd(dueVolume!.data) / 100]).toEqual([0x14, 381.23]);
    });

    it("start with FCB 1 after SND_NKE, then flip it for the next telegram", () => {
        const control = (id: string) => bytes(id)[1]!;
        expect(control("snd-nke")).toBe(0x40);
        expect(bytes("e5")).toEqual([0xe5]);
        for (const id of ["req-1", "req-2"]) expect(control(id) & 0x5f, "REQ_UD2 with FCV").toBe(0x5b);
        expect(control("req-1") & 0x20, "FCB").toBe(0x20);
        expect(control("req-2") & 0x20, "FCB").toBe(0);
    });

    it("take apart the maker code and the DIF that the frames carry", () => {
        const [letters, dif] = lesson.anatomy!;
        const code = letters!.parts.map(([letter]) => letter).join("");
        expect(code).toBe(maker(bytes("rsp-1").slice(11, 13)));
        expect(parseInt(dif!.parts.map(([bits]) => bits).join(""), 2)).toBe(bytes("rsp-2")[23]);
        expect(bytes("rsp-2")[23]).toBe(0x4c);
    });

    it("draw SND_NKE and E5 as 8E1 characters at 2400 baud", () => {
        const bit = 1000 / 2400;
        const decode = (signal: readonly (readonly [number, number])[], start: number, count: number, one: number) => {
            const level = (t: number) => signal.filter(([from]) => from <= t).at(-1)![1];
            return Array.from({ length: count }, (_, n) => {
                const bits = Array.from({ length: 11 }, (_, i) => (level(start + (n * 11 + i + 0.5) * bit) === one ? 1 : 0));
                expect(bits[0], "start bit").toBe(0);
                expect(bits[10], "stop bit").toBe(1);
                expect(bits.slice(1, 10).reduce<number>((sum, b) => sum + b, 0) % 2, "even parity").toBe(0);
                return bits.slice(1, 9).reduceRight<number>((byte, b) => (byte << 1) | b, 0);
            });
        };
        const [master, meter] = lesson.timing!.tracks;
        expect(decode(master!.signal!, 0, 5, 1)).toEqual(bytes("snd-nke"));
        expect(decode(meter!.signal!, 30, 1, meter!.signal![0]![1])).toEqual(bytes("e5"));
        expect(Number(frame("e5").time) * 1000).toBe(30);
    });
});
