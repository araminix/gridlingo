import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const bytes = (id: string) => bytesOf(frame(id).fields!);
const word = (list: number[], at: number) => (list[at]! << 8) | list[at + 1]!;
const ascii = (list: number[]) => String.fromCharCode(...list);

const DCP = ["identify-all", "set-name", "identify-name", "set-ip"];
const CYCLIC = ["out", "in", "in-hot", "out-fans"];

describe("the DCP frames", () => {
    it.each(DCP)("%s is PROFINET, padded to the 60 bytes of a short Ethernet frame", (id) => {
        const list = bytes(id);
        expect(list).toHaveLength(60);
        expect(word(list, 12), "EtherType").toBe(0x8892);
        // 14 bytes of Ethernet header, 10 of DCP header, then the blocks the DCP data length counts
        const length = word(list, 24);
        expect(list.slice(26 + length).every((byte) => byte === 0), "only zeros after the blocks").toBe(true);
        let at = 26;
        while (at < 26 + length) at += 4 + word(list, at + 2) + (word(list, at + 2) % 2);
        expect(at, "the blocks fill the DCP data length").toBe(26 + length);
    });

    it("sends Identify to the PROFINET multicast address and Set to the station", () => {
        for (const id of ["identify-all", "identify-name"]) expect(bytes(id).slice(0, 6)).toEqual([0x01, 0x0e, 0xcf, 0, 0, 0]);
        for (const id of ["set-name", "set-ip"]) expect(bytes(id).slice(0, 6)).toEqual([2, 0, 0, 0, 0, 0x10]);
        expect(bytes("identify-all").slice(14, 18), "FrameID FEFE, Identify request").toEqual([0xfe, 0xfe, 0x05, 0x00]);
        expect(bytes("set-ip").slice(14, 18), "FrameID FEFD, Set request").toEqual([0xfe, 0xfd, 0x04, 0x00]);
    });

    it("names the station trafo-io, permanently, and finds it by that name", () => {
        const set = bytes("set-name");
        expect(set.slice(26, 30), "NameOfStation, 10 bytes").toEqual([0x02, 0x02, 0x00, 0x0a]);
        expect(word(set, 30), "permanent").toBe(1);
        expect(ascii(set.slice(32, 40))).toBe("trafo-io");
        const identify = bytes("identify-name");
        expect(identify.slice(26, 30)).toEqual([0x02, 0x02, 0x00, 0x08]);
        expect(ascii(identify.slice(30, 38))).toBe("trafo-io");
    });

    it("gives the station 192.168.0.10/24 with no gateway, until the next power cut", () => {
        const set = bytes("set-ip");
        expect(set.slice(26, 30)).toEqual([0x01, 0x02, 0x00, 0x0e]);
        expect(word(set, 30), "temporary").toBe(0);
        expect(set.slice(32, 44).join(".")).toBe("192.168.0.10.255.255.255.0.0.0.0.0");
    });
});

describe("the cyclic frames", () => {
    it.each(CYCLIC)("%s carries 40 bytes of data on priority 6, then a good data status", (id) => {
        const list = bytes(id);
        expect(list).toHaveLength(6 + 6 + 4 + 2 + 2 + 40 + 4);
        expect(word(list, 12), "VLAN tag").toBe(0x8100);
        expect(list[14]! >> 5, "priority").toBe(6);
        expect(word(list, 16), "EtherType").toBe(0x8892);
        const id16 = word(list, 18);
        expect(id16 >= 0xc000 && id16 <= 0xf7ff, "a real-time class 1 frame ID").toBe(true);
        expect(list.slice(-2), "data status 0x35, transfer status 0").toEqual([0x35, 0x00]);
    });

    it("sends outputs with frame ID 0xC000 and inputs with 0xC001", () => {
        for (const id of ["out", "out-fans"]) expect(word(bytes(id), 18)).toBe(0xc000);
        for (const id of ["in", "in-hot"]) expect(word(bytes(id), 18)).toBe(0xc001);
    });

    it("carries 72.5 °C and 85.0 °C in tenths, most significant byte first, and the fans as bits 0 and 1", () => {
        expect(word(bytes("in"), 24)).toBe(725);
        expect(word(bytes("in-hot"), 24)).toBe(850);
        expect(bytes("out")[25]).toBe(0b00);
        expect(bytes("out-fans")[25]).toBe(0b11);
        expect(lesson.playground![0]).toMatchObject({ kind: "encoder", type: "int16", order: "ABCD", value: 725 });
    });
});

describe("the data status breakdown", () => {
    it("is 0x35, bit 7 first", () => {
        expect(parseInt(lesson.anatomy![0]!.parts.map(([bit]) => bit).join(""), 2)).toBe(0x35);
    });
});

describe("the watchdog", () => {
    it("fires 3 update times after the last frame each side received", () => {
        const track = (id: string) => lesson.timing!.tracks.find((item) => item.id === id)!.events!;
        const last = (id: string) => Math.max(...track(id).filter((event) => event.mark === "beat").map((event) => event.t));
        const fired = (id: string) => track(id).find((event) => event.mark === "event")!.t;
        expect(fired("out")).toBe(last("out") + 3 * 2);
        expect(fired("in")).toBe(last("in") + 3 * 2);
        const cut = track("cable")[0]!.t;
        expect(last("out")).toBeLessThan(cut);
        expect(last("in")).toBeLessThan(cut);
    });
});
