import { describe, expect, it } from "vitest";
import { berProblems, bytesOf } from "../bytes";
import { lesson } from "./lesson";

const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const framed = lesson.frames.filter((frame) => frame.fields?.length).map((frame) => frame.id);

/** An OID as BER content bytes: the first two numbers in one byte, the rest in base 128. */
function oid(dotted: string) {
    const [first, second, ...rest] = dotted.split(".").map(Number);
    const out = [40 * first! + second!];
    for (let n of rest) {
        const group = [n & 0x7f];
        while ((n >>= 7)) group.unshift(0x80 | (n & 0x7f));
        out.push(...group);
    }
    return [0x06, out.length, ...out];
}
/** Where a run of bytes starts in a message, or -1. */
const find = (list: number[], run: number[]) => list.findIndex((_, i) => run.every((byte, j) => list[i + j] === byte));
/** The value right after an OID in a VarBind: [tag, ...content]. */
function valueAfter(list: number[], dotted: string) {
    const name = oid(dotted);
    const at = find(list, name);
    expect(at, dotted).toBeGreaterThan(0);
    const start = at + name.length;
    return list.slice(start, start + 2 + list[start + 1]!);
}
const number = (content: number[]) => content.reduce((value, byte) => value * 256 + byte, 0);

describe("SNMP messages", () => {
    it.each(framed)("%s is well-formed BER, SNMPv2c, with the community", (id) => {
        const message = bytes(id);
        expect(berProblems(message)).toEqual([]);
        expect(message[0]).toBe(0x30);
        expect(message[1], "the length covers the rest").toBe(message.length - 2);
        expect(message.slice(2, 5), "version 1 = v2c").toEqual([0x02, 0x01, 0x01]);
        expect(String.fromCharCode(...message.slice(7, 17))).toBe("st4tion-ro");
    });

    it("ask with NULL values, and answer the same request ID with the values", () => {
        const [get, response] = [bytes("get"), bytes("response")];
        expect([get[17], response[17]], "GetRequest, Response").toEqual([0xa0, 0xa2]);
        expect(get.slice(19, 23), "request-id").toEqual(response.slice(19, 23));
        for (const name of ["1.3.6.1.2.1.1.3.0", "1.3.6.1.2.1.2.2.1.8.3"]) expect(valueAfter(get, name)).toEqual([0x05, 0x00]);
        expect(number(valueAfter(response, "1.3.6.1.2.1.1.3.0").slice(2)), "sysUpTime").toBe(311_045_600);
        expect(valueAfter(response, "1.3.6.1.2.1.1.3.0")[0], "TimeTicks").toBe(0x43);
        expect(valueAfter(response, "1.3.6.1.2.1.2.2.1.8.3"), "up(1)").toEqual([0x02, 0x01, 0x01]);
    });

    it("send linkDown for port 3: switched on, but down, 67.17 s later", () => {
        const trap = bytes("trap");
        expect(trap[17], "SNMPv2-Trap").toBe(0xa7);
        // The first two values are always sysUpTime.0 and snmpTrapOID.0
        const list = trap.slice(find(trap, [0x30, 0x10]));
        expect(find(list, oid("1.3.6.1.2.1.1.3.0"))).toBe(2);
        expect(number(valueAfter(trap, "1.3.6.1.2.1.1.3.0").slice(2)) - 311_045_600, "hundredths after the answer").toBe(6717);
        expect(valueAfter(trap, "1.3.6.1.6.3.1.1.4.1.0"), "linkDown").toEqual(oid("1.3.6.1.6.3.1.1.5.3"));
        expect(valueAfter(trap, "1.3.6.1.2.1.2.2.1.1.3"), "ifIndex 3").toEqual([0x02, 0x01, 0x03]);
        expect(valueAfter(trap, "1.3.6.1.2.1.2.2.1.7.3"), "ifAdminStatus up").toEqual([0x02, 0x01, 0x01]);
        expect(valueAfter(trap, "1.3.6.1.2.1.2.2.1.8.3"), "ifOperStatus down").toEqual([0x02, 0x01, 0x02]);
    });

    it("take apart the OID of ifOperStatus.3", () => {
        expect([0x06, 0x0a, ...bytesOf(lesson.anatomy![0]!.parts)]).toEqual(oid("1.3.6.1.2.1.2.2.1.8.3"));
    });
});
