import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson as goose } from "../iec-61850-goose/lesson";
import { lesson } from "./lesson";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const bytesOfFrame = (frames: typeof lesson.frames, id: string) => bytesOf(frames.find((frame) => frame.id === id)!.fields!);

/** The redundancy control trailer: the last 6 bytes. */
function trailer(bytes: number[]) {
    const rct = bytes.slice(-6);
    const word = (rct[2]! << 8) | rct[3]!;
    return { seq: (rct[0]! << 8) | rct[1]!, lan: word >> 12, size: word & 0xfff, suffix: (rct[4]! << 8) | rct[5]! };
}

describe("PRP frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s ends in a sound redundancy control trailer", (_, frame) => {
        const bytes = bytesOf(frame.fields!);
        const rct = trailer(bytes);
        expect(rct.suffix, "PRP suffix").toBe(0x88fb);
        expect(rct.lan, "LAN A is 1010, LAN B 1011").toBe(frame.link === "lan-a" ? 0xa : 0xb);
        // The LSDU: everything after the EtherType (behind the VLAN tag), trailer included
        expect(bytes.slice(12, 14), "a VLAN tag").toEqual([0x81, 0x00]);
        expect(rct.size, "LSDU size").toBe(bytes.length - 18);
        expect(bytes.length, "longer than a minimum frame, so no padding").toBeGreaterThan(64);
    });

    it("carry the GOOSE lesson's frames unchanged in front of the trailer", () => {
        const pairs = [
            ["copy-a", "heartbeat"],
            ["copy-b", "heartbeat"],
            ["trip-b", "event"],
        ] as const;
        for (const [ours, theirs] of pairs) {
            const bytes = bytesOfFrame(lesson.frames, ours);
            expect(bytes.slice(0, -6), ours).toEqual(bytesOfFrame(goose.frames, theirs));
            expect(berProblems(bytes, 26, bytes.length - 6), ours).toEqual([]);
        }
    });

    it("send the same copy on both LANs, and number the frames", () => {
        const a = bytesOfFrame(lesson.frames, "copy-a");
        const b = bytesOfFrame(lesson.frames, "copy-b");
        const differ = a.flatMap((byte, i) => (byte === b[i] ? [] : [i]));
        expect(differ, "only the LanId nibble differs").toEqual([a.length - 4]);
        expect(a[a.length - 4]! ^ b[b.length - 4]!, "1010 against 1011").toBe(0x10);
        expect(trailer(a).seq).toBe(3900);
        expect(trailer(b).seq).toBe(3900);
        expect(trailer(bytesOfFrame(lesson.frames, "trip-b")).seq).toBe(3905);
    });

    it("take the trailer apart as it is on the wire", () => {
        const parts = lesson.anatomy![0]!.parts.map(([text]) => text);
        const rct = trailer(bytesOfFrame(lesson.frames, "copy-a"));
        expect(parseInt(parts[0]!.replace(" ", ""), 16)).toBe(rct.seq);
        expect(parseInt(parts[1]!, 16)).toBe(rct.lan);
        expect(parseInt(parts[2]!, 16)).toBe(rct.size);
        expect(parseInt(parts[3]!.replace(" ", ""), 16)).toBe(rct.suffix);
    });

    it("send LAN A's copies over switch A and LAN B's over switch B", () => {
        const { devices, links } = lesson.scene;
        const at = (id: string) => devices.find((device) => device.id === id)!.at;
        // Each LAN's cable turns its corner where its switch stands
        const corner = (id: string) => {
            const link = links.find((item) => item.id === id)!;
            const [from, to] = [at(link.from), at(link.to)];
            return link.via === "y" ? [from[0], to[1]] : [to[0], from[1]];
        };
        expect(corner("lan-a")).toEqual(at("swa"));
        expect(corner("lan-b")).toEqual(at("swb"));
        expect(corner("a-up")).toEqual(at("swa"));
    });
});
