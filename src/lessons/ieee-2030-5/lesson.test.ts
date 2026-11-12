import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import text from "./en.json";
import { lesson } from "./lesson";
import control from "./dercontrol.xml?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const word = (data: readonly number[], at: number) => (data[at]! << 8) | data[at + 1]!;

/** The SFDI: the first 36 bits of the fingerprint as a decimal number, and a digit that makes the sum of all digits a multiple of 10. */
function sfdiOf(fingerprint: string) {
    const number = String(parseInt(fingerprint.slice(0, 9), 16));
    const sum = [...number].reduce((total, digit) => total + Number(digit), 0);
    return number + String((10 - (sum % 10)) % 10);
}

describe("IEEE 2030.5 TLS", () => {
    const hello = bytesOf(frame("client-hello").fields!);

    it("sends a ClientHello whose record and handshake lengths count its bytes", () => {
        expect(hello.slice(0, 3), "a TLS 1.2 handshake record").toEqual([0x16, 0x03, 0x03]);
        expect(word(hello, 3), "record length").toBe(hello.length - 5);
        expect(hello[5], "ClientHello").toBe(0x01);
        expect((hello[6]! << 16) | word(hello, 7), "handshake length").toBe(hello.length - 9);
        expect(word(hello, 9), "client version").toBe(0x0303);
    });

    it("offers only TLS_ECDHE_ECDSA_WITH_AES_128_CCM_8, on P-256 with SHA-256", () => {
        let at = 11 + 32;
        at += 1 + hello[at]!; // session ID
        const suites = word(hello, at);
        expect(suites).toBe(2);
        expect(word(hello, at + 2)).toBe(0xc0ae);
        at += 2 + suites;
        expect(hello.slice(at, at + 2), "one compression method: none").toEqual([0x01, 0x00]);
        at += 2;
        const end = at + 2 + word(hello, at);
        expect(end, "the extensions end the message").toBe(hello.length);
        const extensions = new Map<number, number[]>();
        for (at += 2; at < end; ) {
            const length = word(hello, at + 2);
            extensions.set(word(hello, at), hello.slice(at + 4, at + 4 + length));
            at += 4 + length;
        }
        expect(at).toBe(end);
        expect(extensions.get(0x000a), "supported_groups: secp256r1").toEqual([0x00, 0x02, 0x00, 0x17]);
        expect(extensions.get(0x000b), "ec_point_formats: uncompressed").toEqual([0x01, 0x00]);
        expect(extensions.get(0x000d), "signature_algorithms: ecdsa_secp256r1_sha256").toEqual([0x00, 0x02, 0x04, 0x03]);
    });
});

describe("IEEE 2030.5 device identity", () => {
    const [lfdi, sfdi] = lesson.anatomy!;
    const fingerprint = lfdi!.parts.map(([part]) => part).join("");

    it("takes the LFDI from the first 20 bytes of a SHA-256 fingerprint", () => {
        expect(fingerprint).toMatch(/^[0-9A-F]{64}$/);
        expect(lfdi!.also).toBe(`LFDI = ${fingerprint.slice(0, 40)}`);
        expect(lfdi!.parts[0]![0]).toHaveLength(9);
        expect(text.notes.edev).toContain(fingerprint.slice(0, 40));
    });

    it("computes the SFDI from the first 36 bits, with its check digit", () => {
        const digits = sfdi!.parts.map(([part]) => part).join("");
        expect(digits).toBe(sfdiOf(fingerprint));
        expect(sfdi!.parts[0]![0]).toBe(String(parseInt(lfdi!.parts[0]![0], 16)));
        expect([...digits].reduce((total, digit) => total + Number(digit), 0) % 10).toBe(0);
        expect(sfdi!.also).toContain(`SFDI = ${digits}`);
    });
});

describe("the DERControl sample", () => {
    const xml = new DOMParser().parseFromString(control, "application/xml");
    const value = (name: string) => xml.getElementsByTagNameNS("urn:ieee:std:2030.5:ns", name)[0]?.textContent;

    it("is well-formed IEEE 2030.5 XML", () => {
        expect(xml.getElementsByTagName("parsererror")).toHaveLength(0);
        expect(xml.documentElement.localName).toBe("DERControl");
        expect(xml.documentElement.namespaceURI).toBe("urn:ieee:std:2030.5:ns");
        expect(xml.documentElement.getAttribute("responseRequired")).toBe("03");
    });

    it("limits output to 50 % from 11:00 to 13:00 UTC, as the lesson tells", () => {
        const start = Number(value("start"));
        expect(start).toBe(Date.UTC(2026, 5, 17, 11) / 1000);
        expect(Number(value("duration"))).toBe(2 * 3600);
        expect(Number(value("creationTime"))).toBe(Date.UTC(2026, 5, 17, 9) / 1000);
        expect(Number(value("opModMaxLimW")) / 100, "percent").toBe(50);
        expect(value("currentStatus"), "scheduled").toBe("0");
        // The session starts at 09:30 UTC; the limit starts 5400 s later
        expect(Number(frame("post-started").time)).toBe(start - Date.UTC(2026, 5, 17, 9, 30) / 1000);
    });

    it("has an mRID of 128 bits that ends with the documentation enterprise number", () => {
        const mrid = value("mRID")!;
        expect(mrid).toMatch(/^[0-9A-F]{32}$/);
        expect(parseInt(mrid.slice(-8), 16)).toBe(32473);
    });
});

describe("the playground notes", () => {
    it("sit on the lines they explain", () => {
        const lines = control.split("\n");
        const file = lesson.playground!.find((item) => item.kind === "file")!;
        if (file.kind !== "file") throw new Error("a file playground");
        const expected: Record<string, string> = { href: "href=", reply: "replyTo=", mrid: "<mRID>", created: "<creationTime>", status: "<currentStatus>", duration: "<duration>", start: "<start>", limit: "<opModMaxLimW>" };
        for (const [line, note] of Object.entries(file.notes)) expect(lines[Number(line) - 1], `line ${line}: ${note}`).toContain(expected[note]);
    });
});
