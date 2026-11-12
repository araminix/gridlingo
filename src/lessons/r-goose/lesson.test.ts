import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";

const heartbeat = bytesOf(lesson.frames.find((frame) => frame.id === "heartbeat")!.fields!);
const word = (at: number) => (heartbeat[at]! << 8) | heartbeat[at + 1]!;
const ip = heartbeat.slice(14, 34);
const udp = heartbeat.slice(34);

/** The IPv4 header checksum: the ones' complement of the ones' complement sum of its 16-bit words. */
function ipChecksum(header: readonly number[]) {
    let sum = 0;
    for (let i = 0; i < header.length; i += 2) sum += (header[i]! << 8) | header[i + 1]!;
    while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
    return ~sum & 0xffff;
}

describe("R-GOOSE frames", () => {
    it("send an IPv4 packet to a multicast group, on the Ethernet address of that group", () => {
        expect(word(12), "EtherType IPv4").toBe(0x0800);
        expect(ip[16], "a multicast group (224 to 239)").toBeGreaterThanOrEqual(224);
        expect(ip[16]).toBeLessThanOrEqual(239);
        // 01-00-5E, then the low 23 bits of the group
        expect(heartbeat.slice(0, 6)).toEqual([0x01, 0x00, 0x5e, ip[17]! & 0x7f, ip[18], ip[19]]);
        expect(ip.slice(16).join("."), "239.192.0.1").toBe("239.192.0.1");
        expect(ip.slice(12, 16).join("."), "from relay A").toBe(lesson.scene.devices.find((device) => device.id === "relaya")!.address);
    });

    it("have a sound IPv4 header", () => {
        expect(ip[0], "IPv4, 20-byte header").toBe(0x45);
        expect(ip[1]! >> 2, "DSCP 46, expedited forwarding").toBe(46);
        expect(ip[9], "UDP").toBe(17);
        expect(ip[8], "TTL 16").toBe(16);
        expect(word(20) & 0x3fff, "not a fragment").toBe(0);
        expect(ipChecksum(ip), "the checksum adds up").toBe(0);
        expect(word(16), "total length: the IP header and the UDP datagram").toBe(20 + word(38));
    });

    it("go to UDP port 102, and stop before the parts the lesson tells in words", () => {
        expect(word(36), "destination port").toBe(102);
        expect(word(34), "a port the relay picked").toBe(49153);
        expect(udp, "ports and length; the checksum and the session layer are not shown").toHaveLength(6);
        expect(word(38) - 8, "168 bytes of R-GOOSE after the UDP header").toBe(168);
    });

    it("take the group's MAC address apart as it is on the wire", () => {
        const parts = lesson.anatomy![0]!.parts.map(([text]) => text);
        expect(parts.join("-").split("-").map((pair) => parseInt(pair, 16))).toEqual(heartbeat.slice(0, 6));
    });

    it("count the SPDUs up by one with every message, copies too", () => {
        const spdu = lesson.points!.rows.find((row) => row.id === "spdu")!.values.slice(1).map(([, inDevice]) => Number(inDevice));
        expect(spdu).toEqual([20871, 20872, 20873]);
        for (const [step, number] of [["heartbeat", 20871], ["fault", 20872], ["repeat", 20873]] as const) {
            const frame = lesson.frames.find((item) => item.step === step && item.kind === "R-GOOSE")!;
            expect(frame.name, frame.id).toContain(`SPDU ${number}`);
        }
    });
});
