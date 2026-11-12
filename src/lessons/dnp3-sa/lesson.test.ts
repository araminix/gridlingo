import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";
import settings from "./sa-settings.json?raw";

const framed = lesson.frames.filter((frame) => frame.fields?.length);
const apdu = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const le = (bytes: readonly number[], at: number, size: number) => bytes.slice(at, at + size).reduceRight((value, byte) => value * 256 + byte, 0);

/** The one g120 object of an authentication message: its variation and its bytes, after checking its size prefix. */
function g120(bytes: readonly number[]) {
    const at = bytes[1] === 0x83 ? 4 : 2; // a response carries IIN after the function code
    expect(bytes.slice(at, at + 4).filter((_, i) => i !== 1), "group 120, qualifier 0x5B, one object").toEqual([0x78, 0x5b, 0x01]);
    const size = le(bytes, at + 4, 2);
    const object = bytes.slice(at + 6);
    expect(object, "the size prefix counts the object").toHaveLength(size);
    return { variation: bytes[at + 1], csq: le(object, 0, 4), user: le(object, 4, 2), object };
}

/** The control relay output block of a request or response: control code, count, on and off time, status. */
function crob(bytes: readonly number[]) {
    const at = bytes[1] === 0x81 ? 4 : 2;
    expect(bytes.slice(at, at + 5), "g12v1, qualifier 0x17, one object, index 0").toEqual([0x0c, 0x01, 0x17, 0x01, 0x00]);
    const block = bytes.slice(at + 5);
    expect(block, "a CROB is 11 bytes").toHaveLength(11);
    return { code: block[0], count: block[1], on: le(block, 2, 4), off: le(block, 6, 4), status: block[10] };
}

describe("DNP3 Secure Authentication messages", () => {
    it("are single-fragment application messages with the expected function codes", () => {
        for (const frame of framed) expect(apdu(frame.id)[0]! & 0xf0, `${frame.id}: FIR, FIN, no CON, no UNS`).toBe(0xc0);
        expect(framed.map((frame) => apdu(frame.id)[1])).toEqual([0x05, 0x83, 0x20, 0x81, 0x05, 0x83, 0x20]);
    });

    it("keep one sequence number through command, challenge, reply and response", () => {
        const seq = (id: string) => apdu(id)[0]! & 0x0f;
        expect(["operate", "challenge", "reply", "response"].map(seq)).toEqual([3, 3, 3, 3]);
        expect(["replay-operate", "challenge-6", "replay-reply"].map(seq)).toEqual([10, 10, 10]);
    });

    it("challenge for a critical request with HMAC-SHA-256/16 and enough random data", () => {
        for (const id of ["challenge", "challenge-6"]) {
            const { variation, user, object } = g120(apdu(id));
            expect([variation, user, object[6], object[7]], `${id}: g120v1, user 1, MAC algorithm 4, reason CRITICAL`).toEqual([1, 1, 4, 1]);
            expect(object.slice(8), `${id}: 16 bytes of challenge data`).toHaveLength(16);
        }
        expect(g120(apdu("challenge-6")).object.slice(8), "new random data").not.toEqual(g120(apdu("challenge")).object.slice(8));
    });

    it("reply to the right challenge with a 16-byte MAC, and replay a reply that fits no challenge", () => {
        const reply = g120(apdu("reply"));
        expect([reply.variation, reply.user, reply.object.length - 6]).toEqual([2, 1, 16]);
        expect(reply.csq, "the master answers challenge 5").toBe(g120(apdu("challenge")).csq);

        const challenges = [g120(apdu("challenge")).csq, g120(apdu("challenge-6")).csq];
        expect(challenges, "each challenge gets the next number").toEqual([5, 6]);
        const replayed = g120(apdu("replay-reply"));
        expect(replayed.object.length - 6).toBe(16);
        expect(replayed.csq, "an old challenge number").toBeLessThan(challenges[0]!);
        expect(replayed.csq).not.toBe(challenges[1]);
    });

    it("trip with a 1000 ms pulse, echo the command with status SUCCESS, and replay a close", () => {
        expect(crob(apdu("operate"))).toEqual({ code: 0x81, count: 1, on: 1000, off: 0, status: 0 });
        expect(crob(apdu("response"))).toEqual(crob(apdu("operate")));
        expect(apdu("response").slice(2, 4), "IIN").toEqual([0, 0]);
        expect(crob(apdu("replay-operate"))).toEqual({ code: 0x41, count: 1, on: 1000, off: 0, status: 0 });
    });

    it("show the challenge numbers the bytes carry", () => {
        const row = lesson.points!.rows.find((item) => item.id === "csq")!;
        expect(row.values.find(([step]) => step === "challenge")![1]).toBe(String(g120(apdu("challenge")).csq));
        expect(row.values.find(([step]) => step === "replay")![1]).toBe(String(g120(apdu("challenge-6")).csq));
    });

    it("match the sample settings", () => {
        const file = JSON.parse(settings);
        expect(file).toMatchObject({ outstation: 10, master: 1, secureAuthentication: "SAv5", aggressiveMode: false });
        expect(file.users.map((user: { number: number }) => user.number)).toEqual([1]);
        expect(file.critical).toContain("DIRECT_OPERATE");
        expect(file.critical).not.toContain("READ");
    });
});
