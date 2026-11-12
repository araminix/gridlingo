import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const NODE = 5;

/** A CAN frame as the lesson shows it: the 11-bit identifier (2 bytes), the DLC (1 byte), then the data. */
function can(id: string) {
    const bytes = bytesOf(lesson.frames.find((item) => item.id === id)!.fields!);
    return { identifier: (bytes[0]! << 8) | bytes[1]!, dlc: bytes[2]!, data: bytes.slice(3) };
}
const view = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);

describe("CANopen frames", () => {
    it.each(lesson.frames.map((item) => [item.id] as const))("%s: an 11-bit identifier and a DLC that counts its 0 to 8 data bytes", (id) => {
        const { identifier, dlc, data } = can(id);
        expect(identifier).toBeLessThan(0x800);
        expect(dlc).toBeLessThanOrEqual(8);
        expect(data).toHaveLength(dlc);
    });

    it("use the identifiers of the predefined connection set for node 5", () => {
        const expected = { bootup: 0x700, heartbeat: 0x700, "sdo-req": 0x600, "sdo-resp": 0x580, tpdo: 0x180, "tpdo-low": 0x180, emcy: 0x080, "emcy-reset": 0x080 };
        for (const [id, base] of Object.entries(expected)) expect(can(id).identifier, id).toBe(base + NODE);
        expect(can("nmt-start").identifier).toBe(0x000);
    });

    it("boot, start and beat with the NMT states the text names", () => {
        expect(can("bootup").data).toEqual([0x00]);
        expect(can("nmt-start").data).toEqual([0x01, NODE]);
        expect(can("heartbeat").data).toEqual([0x05]);
    });

    it("read 0x1018 sub 4 with an SDO and get 123456 back, expedited", () => {
        const request = can("sdo-req").data;
        expect(request).toEqual([0x40, 0x18, 0x10, 0x04, 0, 0, 0, 0]);
        const answer = can("sdo-resp").data;
        expect(answer[0], "scs 2, expedited, size given, 4 bytes").toBe(0x43);
        expect(answer.slice(1, 4), "the same index and sub-index").toEqual(request.slice(1, 4));
        expect(view(answer.slice(4)).getUint32(0, true)).toBe(123456);
    });

    it("carry the values the text says in TPDO1, low byte first", () => {
        const decode = (id: string) => {
            const data = view(can(id).data);
            return [data.getUint16(0, true) / 10, data.getInt16(2, true) / 10, data.getUint8(4), data.getInt8(5)];
        };
        expect(decode("tpdo")).toEqual([812.4, 152.3, 68, 31]);
        expect(decode("tpdo-low")).toEqual([809.8, 40, 67, 58]);
    });

    it("raise and clear a temperature emergency", () => {
        const fault = can("emcy").data;
        expect(fault[0]! | (fault[1]! << 8), "error code").toBe(0x4200);
        expect(fault[2], "error register: generic and temperature bits").toBe(0b0000_1001);
        expect(fault.slice(3, 6), "module 3, cell 12, 61 °C").toEqual([3, 12, 61]);
        expect(can("emcy-reset").data).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("split an identifier into a 4-bit function code and a 7-bit node ID", () => {
        const [functionCode, node] = lesson.anatomy![0]!.parts.map(([bits]) => parseInt(bits, 2));
        expect((functionCode! << 7) | node!).toBe(can("tpdo").identifier);
    });
});
