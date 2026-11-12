import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";
import sample from "./dbirth-inv1.json?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;

/** An MQTT PUBLISH taken apart; the remaining length must count every byte after it. */
function publish(id: string) {
    const bytes = bytesOf(frame(id).fields!);
    expect(bytes[0]! >> 4, `${id} is a PUBLISH`).toBe(3);
    expect(bytes[1]! & 0x80, "a one-byte remaining length").toBe(0);
    expect(bytes[1], `${id}: remaining length`).toBe(bytes.length - 2);
    const qos = (bytes[0]! >> 1) & 3;
    const topicLength = (bytes[2]! << 8) | bytes[3]!;
    const topic = String.fromCharCode(...bytes.slice(4, 4 + topicLength));
    const after = 4 + topicLength + (qos ? 2 : 0);
    return { qos, retain: bytes[0]! & 1, topic, payload: bytes.slice(after) };
}

type Value = { wire: number; value: bigint | number[] };

/** Reads protobuf: each field as its number, wire type and value (a varint, 4 bytes, or the bytes of a length-delimited field). */
function protobuf(bytes: readonly number[]) {
    const fields: { field: number; wire: number; value: bigint | number[] }[] = [];
    let at = 0;
    const varint = () => {
        let value = 0n;
        for (let shift = 0n; ; shift += 7n) {
            const byte = bytes[at++]!;
            value |= BigInt(byte & 0x7f) << shift;
            if (!(byte & 0x80)) return value;
        }
    };
    while (at < bytes.length) {
        const tag = Number(varint());
        const [field, wire] = [tag >> 3, tag & 7];
        if (wire === 0) fields.push({ field, wire, value: varint() });
        else if (wire === 5) fields.push({ field, wire, value: bytes.slice(at, (at += 4)) });
        else if (wire === 2) {
            const length = Number(varint());
            expect(at + length, `field ${field} ends inside its parent`).toBeLessThanOrEqual(bytes.length);
            fields.push({ field, wire, value: bytes.slice(at, (at += length)) });
        } else throw new Error(`wire type ${wire}`);
    }
    expect(at).toBe(bytes.length);
    return fields;
}

const only = (fields: ReturnType<typeof protobuf>, field: number): Value => {
    const found = fields.filter((item) => item.field === field);
    expect(found, `exactly one field ${field}`).toHaveLength(1);
    return found[0]!;
};

describe("Sparkplug B messages", () => {
    it("publish the host's STATE as retained JSON at QoS 1, with the time of its CONNECT", () => {
        const state = publish("state");
        expect(state).toMatchObject({ qos: 1, retain: 1, topic: "spBv1.0/STATE/SCADA1" });
        const json = JSON.parse(String.fromCharCode(...state.payload));
        expect(json).toEqual({ online: true, timestamp: Date.parse("2026-11-12T10:40:00.000Z") });
    });

    it("send DDATA at QoS 0 on the device's topic", () => {
        expect(publish("ddata")).toMatchObject({ qos: 0, retain: 0, topic: "spBv1.0/SolarPark/DDATA/GW1/INV1" });
    });

    it("encode the DDATA payload as protobuf: timestamp (1), one metric (2), seq (3)", () => {
        const payload = protobuf(publish("ddata").payload);
        expect(payload.map(({ field, wire }) => [field, wire])).toEqual([
            [1, 0],
            [2, 2],
            [3, 0],
        ]);
        expect(only(payload, 1).value).toBe(BigInt(Date.parse("2026-11-12T10:41:07.280Z")));
        expect(only(payload, 3).value, "seq").toBe(2n);
    });

    it("send the metric by alias, with its read time and a float, and without name or data type", () => {
        const metric = protobuf(only(protobuf(publish("ddata").payload), 2).value as number[]);
        expect(metric.map(({ field, wire }) => [field, wire])).toEqual([
            [2, 0],
            [3, 0],
            [12, 5],
        ]);
        expect(only(metric, 2).value, "alias").toBe(2n);
        expect(only(metric, 3).value).toBe(BigInt(Date.parse("2026-11-12T10:41:07.250Z")));
        const float = new DataView(new Uint8Array(only(metric, 12).value as number[]).buffer).getFloat32(0, true);
        expect(float).toBe(4820.5);
    });

    it("tag the bytes as the lesson says", () => {
        const fields = Object.fromEntries(frame("ddata").fields!.map(([hex, , key]) => [key, hex.split(" ")[0]]));
        expect(fields).toMatchObject({ "payload-time": "08", metric: "12", alias: "10", "metric-time": "18", float: "65", seq: "18" });
        expect(frame("ddata").fields!.find(([, , key]) => key === "metric")![0]).toBe("12 0E");
    });

    it("count seq on from the births, and match the decoded DBIRTH sample", () => {
        const seqOf = (id: string) => Number(/seq (\d+)/.exec(frame(id).name)![1]);
        expect([seqOf("nbirth"), seqOf("dbirth"), seqOf("ddata"), seqOf("ddata-gap")]).toEqual([0, 1, 2, 4]);
        const birth = JSON.parse(sample) as { seq: number; metrics: { name: string; alias: number; dataType: string }[] };
        expect(birth.seq).toBe(seqOf("dbirth"));
        expect(birth.metrics.find((metric) => metric.name === "AC/Power")).toMatchObject({ alias: 2, dataType: "Float" });
        const aliases = birth.metrics.map((metric) => metric.alias);
        expect(new Set(aliases).size, "aliases are unique").toBe(aliases.length);
    });
});
