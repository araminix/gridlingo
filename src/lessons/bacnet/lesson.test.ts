import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import type { Frame } from "../types";
import { lesson } from "./lesson";
import sample from "./energy-controller.json?raw";

interface BacnetObject {
    type: string;
    instance: number;
    presentValue: number;
    covIncrement?: number;
    priorityArray?: (number | null)[];
    relinquishDefault?: number;
}
const controller = JSON.parse(sample) as { device: { instance: number; vendorId: number; maxApdu: number }; objects: BacnetObject[] };

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const bytes = (item: Frame) => bytesOf(item.fields!);

/** Where the APDU's tagged parameters start: after BVLC (4), NPDU (2) and the APDU's own header, by PDU type. */
const HEADER = { 0: 4, 1: 2, 2: 3, 3: 3 } as Record<number, number>;
const parametersAt = (data: number[]) => 6 + HEADER[data[6]! >> 4]!;

/** Walks BACnet tags: each length must fit, and every opening tag must be closed by its own number. */
function tagProblems(data: readonly number[], from: number): string[] {
    const problems: string[] = [];
    const open: number[] = [];
    let at = from;
    while (at < data.length) {
        const byte = data[at++]!;
        let tag = byte >> 4;
        const context = (byte & 0x08) !== 0;
        const lvt = byte & 0x07;
        if (tag === 15) tag = data[at++]!;
        if (context && lvt === 6) {
            open.push(tag);
            continue;
        }
        if (context && lvt === 7) {
            if (open.pop() !== tag) problems.push(`closing tag ${tag} at ${at - 1} closes nothing`);
            continue;
        }
        if (!context && tag === 1) continue; // an application BOOLEAN keeps its value in the length bits
        const length = lvt === 5 ? data[at++]! : lvt;
        at += length;
        if (at > data.length) problems.push(`tag ${tag} runs past the end`);
    }
    if (open.length) problems.push(`tags left open: ${open.join(", ")}`);
    return problems;
}

const real = (data: readonly number[], at: number) => new DataView(new Uint8Array(data.slice(at, at + 4)).buffer).getFloat32(0);
const objectId = (data: readonly number[], at: number) => {
    const value = ((data[at]! << 24) | (data[at + 1]! << 16) | (data[at + 2]! << 8) | data[at + 3]!) >>> 0;
    return [value >>> 22, value & 0x3fffff];
};

describe("BACnet/IP frames", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);
    it.each(framed.map((item) => [item.id, item] as const))("%s: the BVLC length counts the datagram, and the tags add up", (_, item) => {
        const data = bytes(item);
        expect(data[0], "BVLC type").toBe(0x81);
        expect(data[1], "broadcast to several, unicast to one").toBe(typeof item.to === "string" ? 0x0a : 0x0b);
        expect((data[2]! << 8) | data[3]!, "BVLC length").toBe(data.length);
        expect(data[4], "NPDU version").toBe(0x01);
        expect(data[5], "expecting a reply only for confirmed requests").toBe(data[6]! >> 4 === 0 ? 0x04 : 0x00);
        expect(tagProblems(data, parametersAt(data))).toEqual([]);
    });

    it("answer each request with its invoke ID and service", () => {
        for (const [request, answer] of [
            ["read", "read-ack"],
            ["write", "write-ack"],
            ["subscribe", "subscribe-ack"],
        ] as const) {
            const asked = bytes(frame(request));
            const answered = bytes(frame(answer));
            expect(answered[7], `${answer} invoke ID`).toBe(asked[8]);
            expect(answered[8], `${answer} service`).toBe(asked[9]);
        }
        const invokes = ["read", "write", "subscribe"].map((id) => bytes(frame(id))[8]);
        expect(invokes).toEqual([1, 2, 3]);
    });

    it("carry the values the lesson tells", () => {
        const whoIs = bytes(frame("who-is"));
        expect([(whoIs[9]! << 8) | whoIs[10]!, (whoIs[12]! << 8) | whoIs[13]!], "Who-Is range").toEqual([2001, 2001]);
        const iAm = bytes(frame("i-am"));
        expect(objectId(iAm, 9), "I-Am device").toEqual([8, 2001]);
        expect((iAm[14]! << 8) | iAm[15]!, "max APDU").toBe(controller.device.maxApdu);
        expect((iAm[19]! << 8) | iAm[20]!, "vendor").toBe(controller.device.vendorId);
        expect(objectId(bytes(frame("read")), 11), "analog-input 1").toEqual([0, 1]);
        expect(real(bytes(frame("read-ack")), 18)).toBe(268.5);
        expect(objectId(bytes(frame("write")), 11), "analog-value 1").toEqual([2, 1]);
        expect(real(bytes(frame("write")), 19)).toBe(250);
        expect(bytes(frame("write")).slice(-2), "priority 8").toEqual([0x49, 0x08]);
        const cov = bytes(frame("cov"));
        expect(objectId(cov, 11), "from device 2001").toEqual([8, 2001]);
        expect((cov[21]! << 8) | cov[22]!, "time remaining").toBe(3600 - 60);
        expect(real(cov, 28)).toBe(243.5);
    });

    it("notify only a change larger than the COV increment, from the sample file's objects", () => {
        const [meter, limit] = controller.objects;
        expect(controller.device.instance).toBe(2001);
        expect(meter!.presentValue).toBe(real(bytes(frame("read-ack")), 18));
        expect(Math.abs(268.5 - 243.5)).toBeGreaterThan(meter!.covIncrement!);
        expect(limit!.priorityArray).toHaveLength(16);
        expect(limit!.relinquishDefault).toBe(300);
        expect(Number(frame("cov").time) - Number(frame("subscribe").time), "seconds since the subscription").toBe(60);
    });

    it("take apart the same bits the frames carry", () => {
        const [tag, id] = lesson.anatomy!;
        expect(parseInt(tag!.parts.map(([bits]) => bits).join(""), 2)).toBe(0x19);
        const bits = id!.parts.map(([part]) => part).join("");
        expect(bits).toHaveLength(32);
        expect(parseInt(bits, 2)).toBe(0x020007d1);
    });
});

describe("the sample file", () => {
    it("puts each playground note on the line it explains", () => {
        const lines = sample.split("\n");
        const file = lesson.playground!.find((item) => item.kind === "file")!;
        if (file.kind !== "file") throw new Error("a file playground");
        const expected: Record<string, string> = {
            "device-instance": '"instance": 2001',
            port: "47808",
            segmentation: "no-segmentation",
            ai: "analog-input",
            "present-value": '"presentValue": 268.5',
            units: '"units": 48',
            "cov-increment": "covIncrement",
            av: "analog-value",
            "priority-array": "priorityArray",
            relinquish: "relinquishDefault",
        };
        for (const [line, note] of Object.entries(file.notes)) expect(lines[Number(line) - 1], `line ${line}: ${note}`).toContain(expected[note]);
    });
});
