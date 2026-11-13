import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const bytes = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);
const PAN = 0x4c21;

/** The link-local IPv6 address G3-PLC builds from the PAN ID and a short address: fe80::PAN:00ff:fe00:short. */
const address = (short: number) => [0xfe, 0x80, 0, 0, 0, 0, 0, 0, PAN >> 8, PAN & 0xff, 0x00, 0xff, 0xfe, 0x00, short >> 8, short & 0xff];

/** The UDP checksum over the IPv6 pseudo-header (RFC 8200): addresses, UDP length, next header 17. */
function checksum(source: number[], destination: number[], udp: number[]) {
    const data = [...source, ...destination, 0, 0, udp.length >> 8, udp.length & 0xff, 0, 0, 0, 17, ...udp];
    if (data.length % 2) data.push(0);
    let sum = 0;
    for (let i = 0; i < data.length; i += 2) sum += (data[i]! << 8) | data[i + 1]!;
    while (sum > 0xffff) sum = (sum & 0xffff) + (sum >> 16);
    return ~sum & 0xffff || 0xffff;
}

/** Reads a frame: the mesh header, IPHC, the compressed UDP header and what follows. */
function parse(frame: number[]) {
    const [mesh, ...rest] = frame;
    const originator = (rest[0]! << 8) | rest[1]!;
    const final = (rest[2]! << 8) | rest[3]!;
    const iphc = rest.slice(4, 6);
    const nhc = rest[6]!;
    const ports = rest.slice(7, 11);
    const sum = (rest[11]! << 8) | rest[12]!;
    const payload = rest.slice(13);
    return { mesh: mesh!, originator, final, iphc, nhc, ports, sum, payload };
}

describe("G3-PLC frames", () => {
    for (const [id, from, to] of [
        ["get", 0x0000, 0x0002],
        ["response", 0x0002, 0x0000],
    ] as const)
        it(`${id}: a mesh header from ${from} to ${to}, compressed IPv6 and UDP, and a UDP checksum that adds up`, () => {
            const frame = parse(bytes(id));
            expect(frame.mesh >> 6, "mesh dispatch 10").toBe(0b10);
            expect((frame.mesh >> 4) & 0b11, "short originator and final addresses").toBe(0b11);
            expect(frame.mesh & 0x0f, "hops left").toBe(8);
            expect([frame.originator, frame.final]).toEqual([from, to]);
            // 011 TF=11 NH=1 HLIM=10 · CID=0 SAC=0 SAM=11 M=0 DAC=0 DAM=11
            expect(frame.iphc).toEqual([0b0111_1110, 0b0011_0011]);
            expect(frame.nhc, "UDP, ports and checksum inline").toBe(0b1111_0000);
            expect(frame.ports).toEqual([0x0f, 0xdb, 0x0f, 0xdb]);
            // The UDP length is elided: it is 8 plus what follows the checksum
            const udp = [...frame.ports, 0, 8 + frame.payload.length, 0, 0, ...frame.payload];
            expect(frame.sum, "UDP checksum").toBe(checksum(address(from), address(to), udp));
        });

    it("carry the DLMS/COSEM wrapper with the length of what follows", () => {
        for (const id of ["get", "response"]) {
            const { payload } = parse(bytes(id));
            expect(payload.slice(0, 2), "version 1").toEqual([0, 1]);
            expect((payload[6]! << 8) | payload[7]!).toBe(payload.length - 8);
        }
    });

    it("ask for 1-0:1.8.0 attribute 2 and get 303603 back with the same invoke ID", () => {
        const get = parse(bytes("get")).payload.slice(8);
        const response = parse(bytes("response")).payload.slice(8);
        expect(get).toEqual([0xc0, 0x01, 0xc1, 0x00, 0x03, 1, 0, 1, 8, 0, 255, 0x02, 0x00]);
        expect(response.slice(0, 5)).toEqual([0xc4, 0x01, 0xc1, 0x00, 0x06]);
        expect(response.slice(5).reduce((value, byte) => value * 256 + byte, 0)).toBe(303_603);
    });

    it("take apart M2's address as rebuilt from the mesh header", () => {
        expect(bytesOf(lesson.anatomy![0]!.parts)).toEqual(address(0x0002));
    });
});
