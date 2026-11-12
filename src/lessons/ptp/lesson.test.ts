import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const hex = (list: number[]) => list.map((byte) => byte.toString(16).padStart(2, "0")).join("-");
/** A big-endian number of the bytes from..to. */
const number = (list: number[], from: number, to: number) => list.slice(from, to).reduce((value, byte) => value * 256n + BigInt(byte), 0n);
/** A PTP timestamp (6 bytes of seconds, 4 of nanoseconds) as nanoseconds. */
const timestamp = (list: number[], at: number) => number(list, at, at + 6) * 1_000_000_000n + number(list, at + 6, at + 10);

/** The PTP message of a frame: after the 14-byte Ethernet header, without padding. */
const message = (id: string) => {
    const all = bytes(id);
    return all.slice(14, 14 + Number(number(all, 16, 18)));
};

const TYPES: Record<string, [type: number, control: number, interval: number, length: number]> = {
    announce: [0x0b, 5, 0, 64],
    "pdelay-req": [0x02, 5, 0x7f, 54],
    "pdelay-resp": [0x03, 5, 0x7f, 54],
    "pdelay-fup": [0x0a, 5, 0x7f, 54],
    sync: [0x00, 0, 0, 44],
    "fup-gm": [0x08, 2, 0, 44],
    "fup-tc": [0x08, 2, 0, 44],
};

describe("PTP frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s has the EtherType, header and length of its message type", (id, frame) => {
        const all = bytesOf(frame.fields!);
        expect(all.slice(12, 14), "EtherType").toEqual([0x88, 0xf7]);
        expect(all.length, "an Ethernet frame of at least 60 bytes").toBeGreaterThanOrEqual(60);
        const [type, control, interval, length] = TYPES[id]!;
        const ptp = all.slice(14);
        expect(ptp[0], "transportSpecific 0, messageType").toBe(type);
        expect(ptp[1], "versionPTP").toBe(2);
        expect(Number(number(ptp, 2, 4)), "messageLength").toBe(length);
        expect(ptp.length - length, "only padding after the message").toBe(length < 46 ? 46 - length : 0);
        expect(ptp.slice(length).every((byte) => byte === 0), "padding is zero").toBe(true);
        expect(ptp[4], "domain 0").toBe(0);
        expect(ptp[32], "controlField").toBe(control);
        expect(ptp[33], "logMessageInterval").toBe(interval);
    });

    it("send Pdelay to the link-local address and everything else to the PTP multicast address", () => {
        for (const frame of framed) {
            const peer = frame.id.startsWith("pdelay");
            expect(hex(bytes(frame.id).slice(0, 6)), frame.id).toBe(peer ? "01-80-c2-00-00-0e" : "01-1b-19-00-00-00");
        }
    });

    it("make each clockIdentity from the sender's MAC address, with FF FE in the middle", () => {
        for (const id of ["announce", "pdelay-req", "sync", "fup-gm"]) {
            const all = bytes(id);
            const mac = all.slice(6, 12);
            expect(all.slice(34, 42), id).toEqual([...mac.slice(0, 3), 0xff, 0xfe, ...mac.slice(3)]);
        }
        // The switch answers from port 3, whose MAC is its base address + 3
        expect(hex(message("pdelay-resp").slice(20, 30))).toBe("02-00-00-ff-fe-00-02-00-00-03");
        const anatomy = lesson.anatomy![0]!;
        expect(anatomy.parts.map(([text]) => text).join(" ")).toBe("02 00 00 FF FE 00 01 01 00 01");
    });

    it("pair answers with their request and Follow_Ups with their Sync", () => {
        const seq = (id: string) => Number(number(message(id), 30, 32));
        expect([seq("pdelay-req"), seq("pdelay-resp"), seq("pdelay-fup")]).toEqual([337, 337, 337]);
        expect([seq("sync"), seq("fup-gm"), seq("fup-tc")]).toEqual([0x2c1b, 0x2c1b, 0x2c1b]);
        expect(message("pdelay-resp").slice(44, 54), "requestingPortIdentity").toEqual(message("pdelay-req").slice(20, 30));
        expect(message("pdelay-fup").slice(44, 54)).toEqual(message("pdelay-req").slice(20, 30));
        expect(message("sync")[6]! & 0x02, "Sync is two-step").toBe(2);
        expect(message("pdelay-resp")[6]! & 0x02, "Pdelay_Resp is two-step").toBe(2);
    });

    it("announce a GPS-locked grandmaster with the UTC offset of 2026", () => {
        const announce = message("announce");
        expect(announce[7], "flags: UTC offset valid, PTP timescale, time and frequency traceable").toBe(0x04 | 0x08 | 0x10 | 0x20);
        expect(Number(number(announce, 44, 46)), "currentUtcOffset").toBe(37);
        expect([announce[47], announce[48], announce[49], announce[52]], "priority1, clockClass, clockAccuracy, priority2").toEqual([128, 6, 0x21, 128]);
        expect(announce.slice(53, 61), "grandmasterIdentity").toEqual(announce.slice(20, 28));
        expect([Number(number(announce, 61, 63)), announce[63]], "stepsRemoved, timeSource GPS").toEqual([0, 0x20]);
    });

    it("measure the MU's cable at 1486 ns from t1 to t4, though its clock is 2.461318 ms ahead", () => {
        const offset = 2_461_318n;
        const t2 = timestamp(message("pdelay-resp"), 34);
        const t3 = timestamp(message("pdelay-fup"), 34);
        expect(t3 - t2, "the switch answered 48.216 µs later").toBe(48_216n);
        // The MU's own clock: the request left 1486 ns before t2, the answer arrived 1486 ns after t3
        const t1 = t2 - 1486n + offset;
        const t4 = t3 + 1486n + offset;
        expect((t4 - t1 - (t3 - t2)) / 2n).toBe(1486n);
        // t2 is 10:41:06.734 120 506 UTC, counted in TAI
        expect(t2).toBe(BigInt(Date.UTC(2026, 10, 12, 10, 41, 6) / 1000 + 37) * 1_000_000_000n + 734_120_506n);
    });

    it("correct the Sync by the switch's residence time and its cable from the grandmaster, then find the offset", () => {
        const origin = timestamp(message("fup-gm"), 34);
        expect(origin, "10:41:07.000 000 120 UTC, in TAI").toBe(BigInt(Date.UTC(2026, 10, 12, 10, 41, 7) / 1000 + 37) * 1_000_000_000n + 120n);
        expect(timestamp(message("fup-tc"), 34), "the switch keeps the origin time").toBe(origin);
        expect(number(message("fup-gm"), 8, 16), "no correction from the grandmaster").toBe(0n);
        const correction = number(message("fup-tc"), 8, 16);
        expect(correction % 65536n, "whole nanoseconds").toBe(0n);
        expect(correction / 65536n, "7436 ns in the switch + 412 ns of cable").toBe(7436n + 412n);
        expect(bytes("fup-tc").filter((byte, i) => byte !== bytes("fup-gm")[i]).length, "only the correction field changes").toBe(2);

        // The MU's clock reads the arrival 2.461318 ms ahead; the offset is what remains
        const arrival = origin + 412n + 7436n + 1486n + 2_461_318n;
        expect(arrival - origin - correction / 65536n - 1486n).toBe(2_461_318n);
        const [gm, sw, mu] = lesson.timing!.tracks.map((track) => track.events!.map((event) => event.t));
        expect([gm, sw, mu]).toEqual([[0], [0.412, 7.848], [9.334]]);
    });
});
