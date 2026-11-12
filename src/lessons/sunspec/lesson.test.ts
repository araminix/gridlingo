import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";
import models from "./models.json?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const fieldsOf = (id: string) => lesson.frames.find((frame) => frame.id === id)!.fields!;
const bytes = (id: string) => bytesOf(fieldsOf(id));
const word = (data: number[], at: number) => (data[at]! << 8) | data[at + 1]!;
const signed = (value: number) => (value << 16) >> 16;
/** The registers of an answer to FC 03, after its MBAP header, function code and byte count. */
const registers = (id: string) => {
    const data = bytes(id).slice(9);
    return Array.from({ length: data.length / 2 }, (_, i) => word(data, i * 2));
};
const map = JSON.parse(models) as { base: number; marker: string; models: { id: number; header: number; length: number; points?: { name: string; address: number }[] }[] };

const pairs = [
    ["sid-req", "sid-resp"],
    ["common-req", "common-resp"],
    ["hdr-req", "hdr-resp"],
    ["values-req", "values-resp"],
    ["end-req", "end-resp"],
] as const;

describe("SunSpec frames", () => {
    it.each(framed.map((frame) => [frame.id, frame] as const))("%s is Modbus TCP with a length that counts the rest", (_, frame) => {
        const data = bytesOf(frame.fields!);
        expect(word(data, 2)).toBe(0);
        expect(word(data, 4)).toBe(data.length - 6);
        expect(data[6]).toBe(1);
        expect(data[7]).toBe(0x03);
    });

    it.each(pairs.map(([request, response]) => [request, response] as const))("%s is answered with the registers it asked for", (request, response) => {
        const asked = bytes(request);
        const answer = bytes(response);
        expect(word(answer, 0), "transaction ID").toBe(word(asked, 0));
        expect(answer[8], "byte count").toBe(word(asked, 10) * 2);
        expect(answer.length).toBe(9 + word(asked, 10) * 2);
    });

    it("find the marker at the base address and walk the models by their lengths", () => {
        expect(word(bytes("sid-req"), 8)).toBe(40000);
        expect(String.fromCharCode(...bytes("sid-resp").slice(9))).toBe("SunS");
        expect(registers("sid-resp")).toEqual([0x5375, 0x6e53]);

        const [commonId, commonLength] = registers("common-resp");
        expect([commonId, commonLength]).toEqual([1, 66]);
        expect(registers("common-resp")).toHaveLength(2 + commonLength!);

        const next = word(bytes("common-req"), 8) + 2 + commonLength!;
        expect(word(bytes("hdr-req"), 8)).toBe(next);
        const [inverterId, inverterLength] = registers("hdr-resp");
        expect([inverterId, inverterLength]).toEqual([103, 50]);

        expect(word(bytes("end-req"), 8)).toBe(next + 2 + inverterLength!);
        expect(registers("end-resp")).toEqual([0xffff, 0]);
    });

    it("lay out the common model as model 1 does: Mn 16, Md 16, Opt 8, Vr 8, SN 16, DA 1, Pad 1", () => {
        // After the ID and L: each point at its offset, in registers
        const data = bytes("common-resp").slice(9 + 4);
        const points: [string, number][] = [["Mn", 16], ["Md", 16], ["Opt", 8], ["Vr", 8], ["SN", 16], ["DA", 1], ["Pad", 1]];
        expect(points.reduce((sum, [, size]) => sum + size, 0)).toBe(66);
        expect(data).toHaveLength(66 * 2);
        const at: Record<string, number[]> = {};
        let offset = 0;
        for (const [name, size] of points) {
            at[name] = data.slice(offset * 2, (offset + size) * 2);
            offset += size;
        }
        const text = (name: string) => String.fromCharCode(...at[name]!).replace(/\0+$/, "");
        expect(text("Mn")).toBe("Example");
        expect(text("Md")).toBe("EX-5K-3P");
        expect(at.Opt!.every((byte) => byte === 0)).toBe(true);
        expect(text("Vr")).toBe("3.4.1");
        expect(text("SN")).toBe("24110042");
        expect(word(at.DA!, 0)).toBe(1);
        // A string is zeros after its text, and every run shown starts on a register
        for (const name of ["Mn", "Md", "Vr", "SN"]) expect(at[name]!.slice(text(name).length).every((byte) => byte === 0), name).toBe(true);
        for (const [hex] of fieldsOf("common-resp").slice(6)) expect(hex.split(" ").length % 2, hex).toBe(0);
    });

    it("read W and Hz where model 103 keeps them, and scale them as the text says", () => {
        // Model 103's data starts after its 2-register header; W is its 13th register, Hz its 15th
        const data = 40070 + 2;
        expect(word(bytes("values-req"), 8)).toBe(data + 12);
        const [w, wSf, hz, hzSf] = registers("values-resp").map(signed);
        expect(w! * 10 ** wSf!).toBe(4820);
        expect(hz! * 10 ** hzSf!).toBeCloseTo(50.01, 10);
        expect([wSf, hzSf]).toEqual([0, -2]);
    });

    it("match the model list in the sample file", () => {
        expect(map.base).toBe(40000);
        expect(map.marker).toBe("SunS");
        expect(map.models.map((model) => model.id)).toEqual([1, 103, 0xffff]);
        expect(map.models[0]!.header).toBe(map.base + 2);
        for (let i = 1; i < map.models.length; i++) expect(map.models[i]!.header).toBe(map.models[i - 1]!.header + 2 + map.models[i - 1]!.length);
        const point = (name: string) => map.models[1]!.points!.find((item) => item.name === name)!.address;
        const start = map.models[1]!.header + 2;
        expect([point("W"), point("W_SF"), point("Hz"), point("Hz_SF"), point("WH"), point("WH_SF")]).toEqual([12, 13, 14, 15, 22, 24].map((offset) => start + offset));
        expect(word(bytes("values-req"), 8)).toBe(point("W"));
    });
});
