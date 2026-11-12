import { describe, expect, it } from "vitest";
import { berProblems, bytesOf, fieldBytes } from "../bytes";
import { lesson } from "./lesson";
import plan from "./midnight-read.json?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const bytes = (id: string) => bytesOf(frame(id).fields!);
const word = (list: number[], at: number) => (list[at]! << 8) | list[at + 1]!;

/** An object identifier from its BER content bytes: the first byte holds two arcs, the rest 7 bits per byte. */
function oid(content: readonly number[]) {
    const arcs = [Math.floor(content[0]! / 40), content[0]! % 40];
    let arc = 0;
    for (const byte of content.slice(1)) {
        arc = (arc << 7) | (byte & 0x7f);
        if (byte & 0x80) continue;
        arcs.push(arc);
        arc = 0;
    }
    return arcs.join(".");
}

describe("DLMS/COSEM messages", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);

    it.each(framed.map((item) => [item.id, item] as const))("%s: the wrapper has version 1, the right wPorts and counts the APDU", (_, item) => {
        const list = bytesOf(item.fields!);
        expect(word(list, 0), "version").toBe(1);
        const [client, meter] = [0x11, 0x01];
        expect([word(list, 2), word(list, 4)], "source, destination").toEqual(item.from === "headend" ? [client, meter] : [meter, client]);
        expect(word(list, 6), "length").toBe(list.length - 8);
    });

    it.each(["aarq", "aare", "rlrq", "rlre"])("%s: the BER lengths add up", (id) => {
        const list = bytes(id);
        expect(list[9], "outer length").toBe(list.length - 10);
        expect(berProblems(list, 8)).toEqual([]);
    });

    it("propose logical names, LLS and a password in the AARQ", () => {
        const aarq = frame("aarq").fields!;
        const context = fieldBytes(aarq, "context");
        expect(oid(context.slice(4))).toBe("2.16.756.5.8.1.1");
        expect(oid(fieldBytes(aarq, "mech-lls").slice(2))).toBe("2.16.756.5.8.2.1");
        const password = fieldBytes(aarq, "password");
        expect(String.fromCharCode(...password.slice(4))).toBe("12345678");
        expect(password[3]).toBe(8);
        // The octet string holds the whole InitiateRequest
        const initiate = fieldBytes(aarq, "initiate-req", "dlms-version", "conformance-req", "pdu-client");
        expect(fieldBytes(aarq, "user-info")).toEqual([0xbe, initiate.length + 2, 0x04, initiate.length]);
        expect(initiate[0]).toBe(0x01);
        expect(word(initiate, initiate.length - 2)).toBe(65535);
    });

    it("accept in the AARE, with a subset of the services asked for", () => {
        const aare = frame("aare").fields!;
        expect(fieldBytes(aare, "result").at(-1)).toBe(0);
        expect(fieldBytes(aare, "diagnostic").at(-1)).toBe(0);
        const initiate = fieldBytes(aare, "initiate-resp", "dlms-version", "conformance-resp", "pdu-meter", "vaa");
        expect(fieldBytes(aare, "user-info")).toEqual([0xbe, initiate.length + 2, 0x04, initiate.length]);
        const bits = (key: string, fields: typeof aare) => fieldBytes(fields, key).slice(4);
        const asked = bits("conformance-req", frame("aarq").fields!);
        const given = bits("conformance-resp", aare);
        given.forEach((byte, i) => expect(byte & ~asked[i]!, `conformance byte ${i}`).toBe(0));
        expect(word(fieldBytes(aare, "pdu-meter"), 0)).toBe(500);
        expect(word(fieldBytes(aare, "vaa"), 0)).toBe(0x0007);
    });

    it("read class 3, OBIS 1.0.1.8.0.255, attributes 2 and 3, and answer with the same invoke IDs", () => {
        for (const [request, answer, attribute] of [["get-value", "value", 2], ["get-scaler", "scaler", 3]] as const) {
            const asked = bytes(request).slice(8);
            expect(asked.slice(0, 2), "GET-Request-Normal").toEqual([0xc0, 0x01]);
            expect(word(asked, 3), "class").toBe(3);
            expect(asked.slice(5, 11), "OBIS").toEqual([1, 0, 1, 8, 0, 255]);
            expect(asked[11], "attribute").toBe(attribute);
            expect(asked).toHaveLength(13);
            const got = bytes(answer).slice(8);
            expect(got.slice(0, 2), "GET-Response-Normal").toEqual([0xc4, 0x01]);
            expect(got[2], "invoke ID").toBe(asked[2]);
            expect(got[3], "data, not an error").toBe(0);
        }
    });

    it("carry 1234567, scaler 1 and unit Wh: 12 345.67 kWh", () => {
        const value = bytes("value").slice(12);
        expect(value[0], "double-long-unsigned").toBe(0x06);
        const raw = new DataView(new Uint8Array(value.slice(1)).buffer).getUint32(0);
        expect(raw).toBe(1234567);
        const [structure, count, integer, scaler, enumTag, unit] = bytes("scaler").slice(12);
        expect([structure, count, integer, enumTag]).toEqual([0x02, 2, 0x0f, 0x16]);
        expect(unit, "30 is Wh").toBe(30);
        expect((raw * 10 ** (scaler! << 24 >> 24)) / 1000).toBeCloseTo(12345.67, 6);
    });

    it("take the OBIS code apart into the six bytes it travels as", () => {
        const parts = lesson.anatomy![0]!.parts.map(([text]) => Number(text));
        expect(parts).toEqual(fieldBytes(frame("get-value").fields!, "obis"));
    });

    it("plan to read the same register from the meter of the scene", () => {
        const read = JSON.parse(plan) as { meter: string; clientAddress: number; read: { class: number; obis: string; attribute: number }[] };
        expect(read.meter).toBe(lesson.scene.devices.find((device) => device.id === "meter")!.address);
        expect(read.clientAddress).toBe(0x11);
        expect(read.read).toContainEqual(expect.objectContaining({ class: 3, obis: "1-0:1.8.0*255", attribute: 3 }));
    });
});
