import { describe, expect, it } from "vitest";
import { berProblems, bytesOf, fieldBytes } from "../bytes";
import { lesson as iec104 } from "../iec-104/lesson";
import { lesson } from "./lesson";
import certificate from "./eng-laptop-03.txt?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
const bytes = (id: string) => bytesOf(frame(id).fields!);
const u16 = (data: readonly number[], at: number) => (data[at]! << 8) | data[at + 1]!;
const u24 = (data: readonly number[], at: number) => (data[at]! << 16) | (data[at + 1]! << 8) | data[at + 2]!;

/** An AES-GCM record of TLS 1.2: an 8-byte explicit nonce, the encrypted text (as long as the plain one) and a 16-byte tag. */
const sealed = (plain: number) => 8 + plain + 16;

/** The records of a frame: [type, length, body]. An encrypted record shows its header only, so its body is empty. */
function records(data: readonly number[]) {
    const list: { type: number; length: number; body: number[] }[] = [];
    let at = 0;
    while (at < data.length) {
        expect(u16(data, at + 1), "TLS 1.2").toBe(0x0303);
        const length = u16(data, at + 3);
        const body = data.slice(at + 5, at + 5 + length);
        list.push({ type: data[at]!, length, body });
        at += 5 + body.length;
        if (body.length < length) expect(at, "only the last record of a frame may be cut off").toBe(data.length);
    }
    return list;
}

/** Handshake messages in a record body: their type, and each length counts its own body exactly. */
function handshakes(body: readonly number[]) {
    const types: number[] = [];
    let at = 0;
    while (at < body.length) {
        types.push(body[at]!);
        at += 4 + u24(body, at + 1);
    }
    expect(at, "handshake lengths add up to the record").toBe(body.length);
    return types;
}

/** Extensions: each one's length counts its own data, and together they fill the block. */
function extensions(data: readonly number[], at: number) {
    const end = at + 2 + u16(data, at);
    const types: number[] = [];
    for (at += 2; at < end; at += 4 + u16(data, at + 2)) types.push(u16(data, at));
    expect(at, "extension lengths add up").toBe(end);
    return { types, end };
}

describe("IEC 62351-3 TLS records", () => {
    it("ClientHello: TLS 1.2, 32 random bytes, two cipher suites and sound extensions", () => {
        const data = bytes("client-hello");
        const [hello] = records(data);
        expect(hello!.type).toBe(0x16);
        expect(hello!.body.length, "record complete").toBe(hello!.length);
        expect(handshakes(hello!.body)).toEqual([1]);
        const body = hello!.body.slice(4);
        expect(u16(body, 0)).toBe(0x0303);
        expect(fieldBytes(frame("client-hello").fields!, "client-random")).toHaveLength(32);
        expect(body[34], "no session ID").toBe(0);
        expect(u16(body, 35), "cipher suite bytes").toBe(4);
        expect([u16(body, 37), u16(body, 39)]).toEqual([0xc02b, 0xc02f]);
        expect(body.slice(41, 43), "compression: null only").toEqual([1, 0]);
        const { types, end } = extensions(body, 43);
        expect(types).toEqual([0x000a, 0x000d, 0x0017, 0xff01]);
        expect(end).toBe(body.length);
    });

    it("ServerHello: picks one of the offered suites", () => {
        const [hello] = records(bytes("server-hello"));
        expect(hello!.body.length).toBe(hello!.length);
        expect(handshakes(hello!.body)).toEqual([2]);
        const body = hello!.body.slice(4);
        expect(u16(body, 0)).toBe(0x0303);
        expect(body[34], "no session ID").toBe(0);
        expect(u16(body, 35)).toBe(0xc02f);
        expect(body[37], "no compression").toBe(0);
        const { types, end } = extensions(body, 38);
        expect(types).toEqual([0xff01, 0x0017]);
        expect(end).toBe(body.length);
    });

    it("CertificateRequest names the CA in sound DER, then ServerHelloDone", () => {
        const [request, done] = records(bytes("cert-request"));
        expect([request!.body.length, done!.body.length]).toEqual([request!.length, done!.length]);
        expect(handshakes(request!.body)).toEqual([13]);
        expect(handshakes(done!.body)).toEqual([14]);
        const body = request!.body.slice(4);
        expect(body.slice(0, 2), "one type: rsa_sign").toEqual([1, 1]);
        expect(u16(body, 2)).toBe(4);
        const names = u16(body, 8);
        expect(10 + names, "the CA list ends the message").toBe(body.length);
        const dn = body.slice(12, 12 + u16(body, 10));
        expect(dn.length + 2).toBe(names);
        expect(dn[0], "a DER SEQUENCE").toBe(0x30);
        expect(berProblems(dn)).toEqual([]);
        expect(String.fromCharCode(...dn)).toContain("Grid Co");
        expect(String.fromCharCode(...dn)).toContain("Grid CA");
    });

    it.each(["client-finished", "server-finished"])("%s: ChangeCipherSpec, then an encrypted Finished of 12 bytes of verify data", (id) => {
        const [change, fin] = records(bytes(id));
        expect([change!.type, change!.length, change!.body]).toEqual([0x14, 1, [1]]);
        expect(fin!.type).toBe(0x16);
        expect(fin!.body, "encrypted: not shown").toEqual([]);
        expect(fin!.length).toBe(sealed(4 + 12));
    });

    it("carry the IEC 104 frames of the IEC 104 lesson, encrypted with AES-128-GCM", () => {
        const plain = (id: string) => bytesOf(iec104.frames.find((item) => item.id === id)!.fields!).length;
        const [startdt] = records(bytes("startdt"));
        const [trip] = records(bytes("trip"));
        expect([startdt!.type, trip!.type]).toEqual([0x17, 0x17]);
        expect([startdt!.body, trip!.body], "encrypted: not shown").toEqual([[], []]);
        expect(startdt!.length).toBe(sealed(plain("startdt-act")));
        expect(trip!.length).toBe(sealed(plain("trip")));
    });

    it("refuse the laptop with a fatal certificate_expired alert, in clear text", () => {
        const [alert] = records(bytes("alert"));
        expect([alert!.type, alert!.length, ...alert!.body]).toEqual([0x15, 2, 2, 45]);
    });

    it("show a certificate that had expired by the day of the lesson", () => {
        const notAfter = /Not After : (.+)$/m.exec(certificate)![1]!;
        expect(new Date(notAfter).getTime()).toBeLessThan(Date.UTC(2026, 10, 12));
        expect(certificate).toContain("certificate has expired");
        expect(certificate).toContain("Issuer: O=Grid Co, CN=Grid CA");
    });
});
