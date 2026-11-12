import { describe, expect, it } from "vitest";
import { bytesOf, fieldBytes } from "../bytes";
import text from "./en.json";
import { lesson } from "./lesson";
import app from "./supported-app-protocol.xml?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const device = (id: string) => lesson.scene.devices.find((item) => item.id === id)!;

/** The link-local IPv6 address made from a MAC address (EUI-64): FF FE in the middle, the universal/local bit flipped. */
function linkLocal(mac: string) {
    const bytes = mac.split("-").map((pair) => parseInt(pair, 16));
    return [0xfe, 0x80, 0, 0, 0, 0, 0, 0, bytes[0]! ^ 0x02, bytes[1]!, bytes[2]!, 0xff, 0xfe, bytes[3]!, bytes[4]!, bytes[5]!];
}

/** An IPv6 address as people write it: groups without leading zeros, the longest run of zero groups as "::". */
function ipv6(bytes: readonly number[]) {
    const groups = Array.from({ length: 8 }, (_, i) => ((bytes[2 * i]! << 8) | bytes[2 * i + 1]!).toString(16));
    let [start, length] = [-1, 0];
    for (let i = 0; i < 8; i++) {
        let run = 0;
        while (groups[i + run] === "0") run++;
        if (run > length && run > 1) [start, length] = [i, run];
    }
    if (start < 0) return groups.join(":");
    return `${groups.slice(0, start).join(":")}::${groups.slice(start + length).join(":")}`;
}

describe("V2GTP", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);
    it.each(framed.map((item) => [item.id, item] as const))("%s: version, its inverse and a length that counts the payload", (_, item) => {
        const bytes = bytesOf(item.fields!);
        expect(bytes[0]).toBe(0x01);
        expect(bytes[1]).toBe(~bytes[0]! & 0xff);
        expect(new DataView(new Uint8Array(bytes).buffer).getUint32(4)).toBe(bytes.length - 8);
    });

    it("asks with an SDP request for TLS over TCP: 01 FE 90 00 00 00 00 02 00 00", () => {
        expect(bytesOf(frame("sdp-req").fields!)).toEqual([0x01, 0xfe, 0x90, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00]);
    });

    it("answers with the charger's address, made from its MAC, and the port the text names", () => {
        const fields = frame("sdp-res").fields!;
        expect(fieldBytes(fields, "sdp-res")).toEqual([0x90, 0x01]);
        const ip = fieldBytes(fields, "ip-prefix", "ip-id");
        expect(ip).toEqual(linkLocal("02-00-00-00-00-A1"));
        expect(ipv6(ip)).toBe("fe80::ff:fe00:a1");
        expect(device("charger").address).toBe(ipv6(ip));
        const [high, low] = fieldBytes(fields, "port");
        expect((high! << 8) | low!).toBe(54321);
        expect(frame("sdp-res").name).toContain("54321");
        expect(fieldBytes(fields, "tls-res", "tcp")).toEqual([0x00, 0x00]);
    });

    it("gives the car the address its EVCCID makes", () => {
        expect(text.notes.setup).toContain("02-00-00-00-00-E1");
        expect(device("car").address).toBe(ipv6(linkLocal("02-00-00-00-00-E1")));
    });
});

describe("the messages", () => {
    it("send 50 kW as 5000 × 10^1 W, because a value is a 16-bit integer", () => {
        expect(50000).toBeGreaterThan(32767);
        expect(5000).toBeLessThanOrEqual(32767);
        expect(5000 * 10 ** 1).toBe(50000);
    });

    it("ask for no more than the charger gives", () => {
        const [, volts, amps, kw] = text.frames.params.match(/(\d+) V, (\d+) A, (\d+) kW/)!.map(Number);
        const asked = Number(frame("current-demand").name.match(/(\d+) A/)![1]);
        const present = lesson.points!.rows.find((row) => row.id === "voltage")!.values.find(([step]) => step === "charge")![2];
        expect(asked).toBeLessThanOrEqual(amps!);
        expect(parseInt(present)).toBeLessThanOrEqual(volts!);
        expect((parseInt(present) * asked) / 1000).toBeLessThanOrEqual(kw!);
    });
});

describe("supportedAppProtocolReq", () => {
    const xml = new DOMParser().parseFromString(app, "application/xml");
    const entries = Array.from(xml.documentElement.children);
    const value = (entry: Element, name: string) => entry.getElementsByTagName(name)[0]?.textContent;

    it("is sound XML in the AppProtocol namespace, with unqualified entries", () => {
        expect(xml.getElementsByTagName("parsererror")).toHaveLength(0);
        expect(xml.documentElement.localName).toBe("supportedAppProtocolReq");
        expect(xml.documentElement.namespaceURI).toBe("urn:iso:15118:2:2010:AppProtocol");
        expect(entries.map((entry) => [entry.localName, entry.namespaceURI])).toEqual([
            ["AppProtocol", null],
            ["AppProtocol", null],
        ]);
    });

    it("puts ISO 15118-2 first and DIN 70121 second, with distinct schema ids", () => {
        expect(entries.map((entry) => [value(entry, "ProtocolNamespace"), value(entry, "Priority"), value(entry, "SchemaID")])).toEqual([
            [lesson.anatomy![0]!.also, "1", "1"],
            ["urn:din:70121:2012:MsgDef", "2", "2"],
        ]);
    });

    it("takes the namespace apart into the parts the anatomy shows", () => {
        const [anatomy] = lesson.anatomy!;
        expect(anatomy!.parts.map(([part]) => part).join(":")).toBe(anatomy!.also);
    });

    it("has each note on the line it explains", () => {
        const expected: Record<string, string> = {
            root: "supportedAppProtocolReq xmlns",
            iso: "urn:iso:15118:2:2013:MsgDef",
            version: "<VersionNumberMajor>2<",
            "schema-id": "<SchemaID>1<",
            priority: "<Priority>1<",
            din: "urn:din:70121:2012:MsgDef",
        };
        const [item] = lesson.playground!;
        if (item?.kind !== "file") throw new Error("a file playground");
        const lines = item.file.split("\n");
        for (const [line, note] of Object.entries(item.notes)) expect(lines[Number(line) - 1], note).toContain(expected[note]);
    });
});
