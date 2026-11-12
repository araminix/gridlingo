import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson } from "./lesson";

describe("GOOSE frames", () => {
    const framed = lesson.frames.filter((frame) => frame.fields?.length);
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s has a sound header and BER encoding", (_, frame) => {
        const bytes = bytesOf(frame.fields!);
        expect(bytes.slice(0, 3), "a GOOSE multicast address").toEqual([0x01, 0x0c, 0xcd]);
        expect(bytes.slice(16, 18), "EtherType after the VLAN tag").toEqual([0x88, 0xb8]);
        expect((bytes[20]! << 8) | bytes[21]!, "length from the APPID to the end").toBe(bytes.length - 18);
        expect(berProblems(bytes, 26)).toEqual([]);
    });

    it("raise the state number on a change and restart the sequence number", () => {
        const counters = framed.map((frame) => {
            const bytes = bytesOf(frame.fields!);
            const at = (tag: number) => bytes[bytes.indexOf(tag, 28) + 2];
            return [at(0x85), at(0x86)];
        });
        expect(counters).toEqual([
            [12, 3],
            [13, 0],
            [13, 1],
        ]);
    });
});
