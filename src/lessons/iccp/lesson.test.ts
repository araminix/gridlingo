import { describe, expect, it } from "vitest";
import { berProblems, bytesOf, fieldBytes } from "../bytes";
import { lesson } from "./lesson";
import table from "./bilateral-table.json?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const text = (bytes: readonly number[]) => String.fromCharCode(...bytes);
/** A BER value with a short length: its tag, its length and its content. */
const tlv = (bytes: readonly number[]) => ({ tag: bytes[0], length: bytes[1], content: bytes.slice(2) });

describe("ICCP (MMS) frames", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);
    const bilateral = JSON.parse(table) as { bilateralTable: string; bilateralTableId: string; read: Record<string, string> };

    it.each(framed.map((item) => [item.id, item] as const))("%s: TPKT counts the whole message and the BER lengths add up", (_, item) => {
        const bytes = bytesOf(item.fields!);
        expect(bytes.slice(0, 2)).toEqual([0x03, 0x00]);
        expect((bytes[2]! << 8) | bytes[3]!).toBe(bytes.length);
        expect(bytes.slice(4, 11), "COTP data and session headers").toEqual([0x02, 0xf0, 0x80, 0x01, 0x00, 0x01, 0x00]);
        expect(berProblems(bytes, 11)).toEqual([]);
    });

    it("read Bilateral_Table_ID in the client's own domain", () => {
        const fields = frame("blt-req").fields!;
        const domain = tlv(fieldBytes(fields, "domain"));
        const item = tlv(fieldBytes(fields, "item"));
        expect([domain.tag, item.tag], "MMS Identifiers are VisibleStrings").toEqual([0x1a, 0x1a]);
        expect([domain.length, item.length]).toEqual([domain.content.length, item.content.length]);
        expect(text(domain.content)).toBe(bilateral.bilateralTable);
        expect(text(item.content)).toBe("Bilateral_Table_ID");
    });

    it("answer the same invoke ID with the ID of the sample bilateral table", () => {
        expect(fieldBytes(frame("blt-resp").fields!, "invoke-resp")).toEqual(fieldBytes(frame("blt-req").fields!, "invoke"));
        const value = tlv(fieldBytes(frame("blt-resp").fields!, "blt-value"));
        expect(value.tag, "Data: visible-string [10]").toBe(0x8a);
        expect(value.length).toBe(value.content.length);
        expect(text(value.content)).toBe(bilateral.bilateralTableId);
    });

    it("report only values the bilateral table gives the DSO", () => {
        const names = Object.keys(bilateral.read);
        for (const row of lesson.points!.rows.filter((item) => item.id !== "blt")) expect(names).toContain(row.address);
        expect(names).not.toContain("GEN_K1_MW");
    });
});
