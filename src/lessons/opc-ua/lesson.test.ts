import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const frame = (id: string) => bytesOf(lesson.frames.find((item) => item.id === id)!.fields!);
const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);
const u32 = (bytes: number[], at: number) => view(bytes).getUint32(at, true);
const ascii = (bytes: number[]) => String.fromCharCode(...bytes);

/** A UA DateTime (100 ns steps since 1601, low byte first) as an ISO time. */
const dateTime = (bytes: number[], at: number) => new Date(Number(view(bytes).getBigInt64(at, true) / 10_000n - 11_644_473_600_000n)).toISOString();

/** The bytes of the field with this key in a frame. */
const field = (id: string, key: string) => bytesOf(lesson.frames.find((item) => item.id === id)!.fields!.filter(([, , name]) => name === key));

describe("OPC UA binary messages", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);
    it.each(framed.map((item) => [item.id, item] as const))("%s: a message type, F, and a size that counts every byte", (_, item) => {
        const bytes = bytesOf(item.fields!);
        expect(["HEL", "ACK", "OPN", "MSG"]).toContain(ascii(bytes.slice(0, 3)));
        expect(ascii(bytes.slice(3, 4))).toBe("F");
        expect(u32(bytes, 4)).toBe(bytes.length);
    });

    it("say Hello with the endpoint URL, and get an ACK of the fixed size 28", () => {
        const hello = frame("hel");
        expect(u32(hello, 28)).toBe(24);
        expect(ascii(hello.slice(32))).toBe("opc.tcp://10.0.0.40:4840");
        expect([8, 12, 16, 20, 24].map((at) => u32(hello, at))).toEqual([0, 65536, 65536, 16777216, 0]);
        const ack = frame("ack");
        expect(ack).toHaveLength(28);
        expect([8, 12, 16, 20, 24].map((at) => u32(ack, at))).toEqual([0, 65536, 65536, 16777216, 256]);
    });

    it("open the channel with the policy None and no certificates", () => {
        for (const id of ["opn-req", "opn-resp"]) {
            const bytes = frame(id);
            expect(u32(bytes, 12)).toBe(47);
            expect(ascii(bytes.slice(16, 63))).toBe("http://opcfoundation.org/UA/SecurityPolicy#None");
            expect(bytes.slice(63, 71)).toEqual(Array(8).fill(0xff));
        }
        expect(u32(frame("opn-req"), 8), "no channel yet").toBe(0);
        expect(u32(frame("opn-resp"), 8), "the server names it 5").toBe(5);
        expect(field("opn-req", "mode-none")).toEqual([1, 0, 0, 0]);
    });

    it("name each body by the NodeId of its type, in four bytes", () => {
        const types = { "opn-req": 446, "opn-resp": 449, "read-req": 631, "read-resp": 634 };
        for (const [id, number] of Object.entries(types)) {
            const key = lesson.frames.find((item) => item.id === id)!.fields!.find(([, , name]) => name.startsWith("type-"))![2];
            const bytes = field(id, key);
            expect(bytes.slice(0, 2), id).toEqual([0x01, 0x00]);
            expect(bytes[2]! | (bytes[3]! << 8), id).toBe(number);
        }
    });

    it("carry the times the text says", () => {
        expect(dateTime(field("opn-req", "t-opn"), 0)).toBe("2026-11-12T10:41:05.120Z");
        expect(dateTime(field("opn-resp", "t-opn-resp"), 0)).toBe("2026-11-12T10:41:05.124Z");
        expect(dateTime(field("read-req", "t-read"), 0)).toBe("2026-11-12T10:41:06.300Z");
        expect(dateTime(field("read-resp", "source-time"), 0)).toBe("2026-11-12T10:41:06.000Z");
        expect(dateTime(field("read-resp", "server-time"), 0)).toBe("2026-11-12T10:41:06.302Z");
    });

    it("read the Value of ns=2;s=PV1.TotW, on channel 5, and get 4820.0 as a Float", () => {
        const request = frame("read-req");
        expect(u32(request, 8), "channel").toBe(5);
        const node = field("read-req", "node");
        expect(node[0], "a string NodeId").toBe(0x03);
        expect(node[1]! | (node[2]! << 8), "namespace").toBe(2);
        expect(u32(node, 3)).toBe(8);
        expect(ascii(node.slice(7))).toBe("PV1.TotW");
        expect(field("read-req", "attr-13")).toEqual([13, 0, 0, 0]);

        const answer = frame("read-resp");
        expect(u32(answer, 8), "channel").toBe(5);
        expect(u32(answer, 20), "request ID").toBe(u32(request, 20));
        expect(field("read-resp", "mask")).toEqual([0x0d]);
        expect(field("read-resp", "float")).toEqual([10]);
        expect(view(field("read-resp", "value")).getFloat32(0, true)).toBe(4820);
    });
});
