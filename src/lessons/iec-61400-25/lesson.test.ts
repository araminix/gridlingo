import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson } from "./lesson";
import { parseScl, type SclNode } from "@/playground/scl";
import turbine from "./wind-turbine.cid?raw";

const frame = (id: string) => bytesOf(lesson.frames.find((item) => item.id === id)!.fields!);
const float = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer).getFloat32(0);

/** The visible strings (tag 0x1A) in a message, in order. */
function strings(bytes: number[]) {
    const found: string[] = [];
    for (let at = 0; at < bytes.length - 1; at++) {
        if (bytes[at] !== 0x1a) continue;
        const length = bytes[at + 1]!;
        const text = String.fromCharCode(...bytes.slice(at + 2, at + 2 + length));
        if (/^[\w$]+$/.test(text) && text.length === length) found.push(text);
    }
    return found;
}

describe("IEC 61400-25 frames (the MMS mapping)", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);
    it.each(framed.map((item) => [item.id, item] as const))("%s: TPKT counts the whole message and the BER lengths add up", (_, item) => {
        const bytes = bytesOf(item.fields!);
        expect(bytes.slice(0, 2)).toEqual([0x03, 0x00]);
        expect((bytes[2]! << 8) | bytes[3]!).toBe(bytes.length);
        expect(bytes.slice(4, 11), "COTP data and session headers").toEqual([0x02, 0xf0, 0x80, 0x01, 0x00, 0x01, 0x00]);
        expect(berProblems(bytes, 11)).toEqual([]);
    });

    it("read the wind data objects the text names", () => {
        const domain = "WT01WTG";
        expect(strings(frame("read-req"))).toEqual([domain, "WTUR1$MX$W$mag$f", domain, "WROT1$MX$RotSpd$mag$f", domain, "WMET1$MX$HorWdSpd$mag$f"]);
    });

    it("answer with three floats, most significant byte first, in the order asked for", () => {
        const answer = frame("read-resp");
        expect([answer.slice(-18, -14), answer.slice(-11, -7), answer.slice(-4)].map(float)).toEqual([2350, 12.75, 9.5]);
    });

    it("enable the report with a boolean TRUE and get success under the same invoke ID", () => {
        const request = frame("enable-req");
        expect(strings(request)).toEqual(["WT01WTG", "LLN0$RP$urcbWTG01$RptEna"]);
        expect(request.slice(-3)).toEqual([0x83, 0x01, 0x01]);
        const answer = frame("enable-resp");
        expect(answer.slice(22, 25)).toEqual(request.slice(22, 25));
        expect(answer.slice(-4)).toEqual([0xa5, 0x02, 0x81, 0x00]);
    });

    it("read values the sample turbine describes, in the report's data set", () => {
        const result = parseScl(turbine);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const names = (nodes: SclNode[]): string[] => nodes.flatMap((node) => [node.name, ...names(node.children)]);
        const all = names(result.ieds);
        for (const name of ["WT01WTG", "WTUR1", "W", "WROT1", "RotSpd", "WMET1", "HorWdSpd", "urcbWTG", "WTG/WTUR1.W.mag.f"]) expect(all).toContain(name);
    });
});
