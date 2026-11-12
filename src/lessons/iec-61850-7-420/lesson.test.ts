import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson } from "./lesson";
import { parseScl, type SclNode } from "@/playground/scl";
import bess from "./bess.cid?raw";

const frame = (id: string) => bytesOf(lesson.frames.find((item) => item.id === id)!.fields!);
const ascii = (bytes: number[]) => String.fromCharCode(...bytes);
const float = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer).getFloat32(0);

/** The visible strings (tag 0x1A) in a message, in order. */
function strings(bytes: number[]) {
    const found: string[] = [];
    for (let at = 0; at < bytes.length - 1; at++) {
        if (bytes[at] !== 0x1a) continue;
        const length = bytes[at + 1]!;
        const text = ascii(bytes.slice(at + 2, at + 2 + length));
        if (/^[\w$]+$/.test(text) && text.length === length) found.push(text);
    }
    return found;
}

describe("IEC 61850-7-420 frames", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);
    it.each(framed.map((item) => [item.id, item] as const))("%s: TPKT counts the whole message and the BER lengths add up", (_, item) => {
        const bytes = bytesOf(item.fields!);
        expect(bytes.slice(0, 2)).toEqual([0x03, 0x00]);
        expect((bytes[2]! << 8) | bytes[3]!).toBe(bytes.length);
        expect(bytes.slice(4, 11), "COTP data and session headers").toEqual([0x02, 0xf0, 0x80, 0x01, 0x00, 0x01, 0x00]);
        expect(berProblems(bytes, 11)).toEqual([]);
    });

    it("read the two variables the text names, and get them back as floats", () => {
        expect(strings(frame("read-req"))).toEqual(["BESS1DER", "DSTO1$MX$UseSocPct$mag$f", "BESS1DER", "MMXU1$MX$TotW$mag$f"]);
        const answer = frame("read-resp");
        expect(float(answer.slice(-11, -7))).toBe(68.5);
        expect(float(answer.slice(-4))).toBe(3000);
    });

    it("operate WMaxSpt with an Oper structure that holds 2000.0, orCat 5 and the time in the text", () => {
        const bytes = frame("oper-req");
        expect(strings(bytes)).toEqual(["BESS1DER", "DWMX1$CO$WMaxSpt$Oper"]);
        const at = bytes.indexOf(0x87);
        expect(bytes.slice(at, at + 3)).toEqual([0x87, 0x05, 0x08]);
        expect(float(bytes.slice(at + 3, at + 7))).toBe(2000);
        expect(bytes.slice(at + 7, at + 12), "origin with orCat 5").toEqual([0xa2, 0x08, 0x85, 0x01, 0x05]);
        const time = bytes.indexOf(0x91);
        const seconds = new DataView(new Uint8Array(bytes.slice(time + 2, time + 6)).buffer).getUint32(0);
        const fraction = ((bytes[time + 6]! << 16) | (bytes[time + 7]! << 8) | bytes[time + 8]!) / 2 ** 24;
        expect(new Date((seconds + fraction) * 1000).toISOString()).toBe("2026-11-12T10:41:12.250Z");
        expect(bytes.slice(-4), "Check: a bit string of 2 bits").toEqual([0x84, 0x02, 0x06, 0x00]);
    });

    it("answer the write with success, under the same invoke ID", () => {
        const request = frame("oper-req");
        const answer = frame("oper-resp");
        expect(answer.slice(22, 25)).toEqual(request.slice(22, 25));
        expect(answer.slice(-4)).toEqual([0xa5, 0x02, 0x81, 0x00]);
    });

    it("use names the sample file describes", () => {
        const result = parseScl(bess);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const names = (nodes: SclNode[]): string[] => nodes.flatMap((node) => [node.name, ...names(node.children)]);
        const all = names(result.ieds);
        for (const name of ["BESS1DER", "DSTO1", "UseSocPct", "MMXU1", "TotW", "DWMX1", "WMaxSpt", "Oper", "ctlVal", "urcbDER"]) expect(all).toContain(name);
    });
});
