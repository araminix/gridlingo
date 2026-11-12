import { describe, expect, it } from "vitest";
import { decode, encode, formatFloat, parseHex, toHex } from "./encode";

describe("the encoder", () => {
    it("writes a float in each byte order", () => {
        expect(toHex(encode(4.82, "float32", "ABCD")!)).toBe("40 9A 3D 71");
        expect(toHex(encode(4.82, "float32", "DCBA")!)).toBe("71 3D 9A 40");
        expect(toHex(encode(4.82, "float32", "BADC")!)).toBe("9A 40 71 3D");
        expect(toHex(encode(4.82, "float32", "CDAB")!)).toBe("3D 71 40 9A");
    });

    it("reads back what it wrote, and shows what a wrong order makes of it", () => {
        for (const order of ["ABCD", "DCBA", "BADC", "CDAB"] as const) expect(formatFloat(decode(encode(4820, "float32", order)!, "float32", order)!)).toBe("4820");
        expect(decode([0x45, 0x96, 0xa0, 0x00], "float32", "DCBA")).not.toBeCloseTo(4820);
    });

    it("handles 16- and 32-bit integers and refuses values that do not fit", () => {
        expect(toHex(encode(-2, "int16", "ABCD")!)).toBe("FF FE");
        expect(toHex(encode(4820, "uint16", "DCBA")!)).toBe("D4 12");
        expect(decode([0xff, 0xfe], "int16", "ABCD")).toBe(-2);
        expect(decode([0x00, 0x01, 0x00, 0x00], "uint32", "CDAB")).toBe(1);
        expect(encode(70000, "uint16", "ABCD")).toBeNull();
        expect(encode(-1, "uint32", "ABCD")).toBeNull();
        expect(decode([1, 2, 3], "float32", "ABCD")).toBeNull();
    });

    it("reads hex written in the usual ways", () => {
        expect(parseHex("71 3d 9a 40")).toEqual([0x71, 0x3d, 0x9a, 0x40]);
        expect(parseHex("0x71,0x3D")).toEqual([0x71, 0x3d]);
        expect(parseHex("713")).toBeNull();
        expect(parseHex("zz")).toBeNull();
    });
});
