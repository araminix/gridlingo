import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import type { Frame } from "../types";
import { lesson } from "./lesson";

const TYPES: Record<string, number> = { CONNECT: 1, CONNACK: 2, PUBLISH: 3, PUBACK: 4, SUBSCRIBE: 8, SUBACK: 9, PINGREQ: 12, PINGRESP: 13 };

/** An MQTT packet taken apart: its type, its flags and the bytes after the remaining length, which must count them. */
function packet(frame: Frame) {
    const bytes = bytesOf(frame.fields!);
    let length = 0;
    let at = 1;
    for (let shift = 0; ; shift += 7) {
        const byte = bytes[at++]!;
        length += (byte & 0x7f) << shift;
        if (!(byte & 0x80)) break;
    }
    return { type: bytes[0]! >> 4, flags: bytes[0]! & 0x0f, length, body: bytes.slice(at) };
}

/** Reads the 2-byte big-endian lengths and numbers of MQTT. */
function reader(body: number[]) {
    let at = 0;
    const read = {
        u8: () => body[at++]!,
        u16: () => (body[at++]! << 8) | body[at++]!,
        text: () => {
            const length = read.u16();
            const text = String.fromCharCode(...body.slice(at, at + length));
            at += length;
            return text;
        },
        rest: () => String.fromCharCode(...body.slice(at)),
        done: () => at === body.length,
    };
    return read;
}

/** A PUBLISH: QoS, retain, topic, packet id and payload. */
function publish(frame: Frame) {
    const { type, flags, body } = packet(frame);
    expect(type, `${frame.id} is a PUBLISH`).toBe(3);
    const read = reader(body);
    const qos = (flags >> 1) & 3;
    return { qos, retain: flags & 1, topic: read.text(), id: qos ? read.u16() : undefined, payload: read.rest() };
}

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;

/** Whether a topic filter (with + and #) matches a topic. */
function matches(filter: string, topic: string) {
    const want = filter.split("/");
    const have = topic.split("/");
    for (let i = 0; i < want.length; i++) {
        if (want[i] === "#") return true;
        if (want[i] !== "+" && want[i] !== have[i]) return false;
    }
    return want.length === have.length;
}

describe("MQTT packets", () => {
    const framed = lesson.frames.filter((item) => item.fields?.length);

    it.each(framed.map((item) => [item.id, item] as const))("%s: its type is its kind and its remaining length counts the bytes after it", (_, item) => {
        const { type, length, body } = packet(item);
        expect(type).toBe(TYPES[item.kind]);
        expect(length).toBe(body.length);
    });

    it("encode a remaining length of 129 in two bytes", () => {
        expect(bytesOf(frame("publish").fields!).slice(1, 3)).toEqual([0x81, 0x01]);
        expect(packet(frame("publish")).length).toBe(129);
    });

    it("connect with MQTT 3.1.1, clean session, a retained QoS 1 will and a login", () => {
        const { flags, body } = packet(frame("connect"));
        expect(flags).toBe(0);
        const read = reader(body);
        expect(read.text()).toBe("MQTT");
        expect(read.u8(), "level 4 = 3.1.1").toBe(4);
        const connect = read.u8();
        expect({ user: connect >> 7, password: (connect >> 6) & 1, willRetain: (connect >> 5) & 1, willQos: (connect >> 3) & 3, will: (connect >> 2) & 1, clean: (connect >> 1) & 1, reserved: connect & 1 }).toEqual({
            user: 1,
            password: 1,
            willRetain: 1,
            willQos: 1,
            will: 1,
            clean: 1,
            reserved: 0,
        });
        expect(read.u16(), "keep alive").toBe(60);
        expect([read.text(), read.text(), read.text(), read.text(), read.text()]).toEqual(["plant-gw1", "plant/gw1/status", "offline", "gw1", "Gw1-p4ss"]);
        expect(read.done()).toBe(true);
        expect(packet(frame("connack")).body, "session present 0, accepted").toEqual([0, 0]);
    });

    it("acknowledge each QoS 1 packet with its own packet id", () => {
        for (const [sent, ack] of [
            ["online", "online-ack"],
            ["publish", "publish-ack"],
            ["forward", "forward-ack"],
        ] as const) {
            const message = publish(frame(sent));
            expect(message.qos).toBe(1);
            expect(frame(ack).from, `${ack} answers ${sent}`).toBe(frame(sent).to);
            expect(reader(packet(frame(ack)).body).u16(), `${ack} id`).toBe(message.id);
        }
        expect(publish(frame("publish")).id, "the gateway counts on").toBe(2);
        expect(publish(frame("forward")).id, "the broker numbers its own").toBe(1);
    });

    it("subscribe with two filters and get one granted QoS per filter", () => {
        const { flags, body } = packet(frame("subscribe"));
        expect(flags, "SUBSCRIBE flags 0010").toBe(2);
        const read = reader(body);
        const id = read.u16();
        const filters: [string, number][] = [];
        while (!read.done()) filters.push([read.text(), read.u8()]);
        expect(filters).toEqual([
            ["plant/+/telemetry", 1],
            ["plant/+/status", 0],
        ]);
        const suback = packet(frame("suback")).body;
        expect((suback[0]! << 8) | suback[1]!).toBe(id);
        expect(suback.slice(2)).toEqual([1, 0]);
    });

    it("deliver each message at the lower QoS, with the retain flag only for a new subscription", () => {
        const kept = publish(frame("retained"));
        expect(kept).toMatchObject({ qos: 0, retain: 1, topic: "plant/gw1/status", payload: "online" });
        expect(publish(frame("online")).retain).toBe(1);
        const forward = publish(frame("forward"));
        expect(forward).toMatchObject({ qos: 1, retain: 0, topic: "plant/inv1/telemetry" });
        expect(forward.payload).toBe(publish(frame("publish")).payload);
        expect(publish(frame("will"))).toMatchObject({ qos: 0, retain: 0, topic: "plant/gw1/status", payload: "offline" });
        expect(matches("plant/+/status", "plant/gw1/status")).toBe(true);
        expect(matches("plant/+/telemetry", "plant/inv1/telemetry")).toBe(true);
        expect(matches("plant/+/telemetry", "plant/gw1/status")).toBe(false);
    });

    it("carry the telemetry the lesson tells", () => {
        expect(JSON.parse(publish(frame("publish")).payload)).toEqual({ ts: "2026-11-12T10:41:07.280Z", p_kw: 4820.5, q_kvar: 610.2, u_v: 20150, f_hz: 50.01, state: "running" });
    });

    it("send the will 1.5 × the keep alive after the gateway's last packet", () => {
        const last = lesson.frames.filter((item) => item.from === "gateway").at(-1)!;
        expect(Number(frame("will").time)).toBe(Number(last.time) + 1.5 * 60);
        expect(lesson.timing!.tracks[1]!.events![0]!.t).toBe(Number(frame("will").time));
        expect(packet(frame("ping")).body).toEqual([]);
    });
});
