import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import boot from "./boot-notification.json?raw";
import text from "./en.json";
import { lesson } from "./lesson";
import meter from "./transaction-event.json?raw";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;
/** A message as it travels: compact JSON, one line, no spaces. */
const wire = (file: string) => JSON.stringify(JSON.parse(file));
/** The CSMS's answer to the BootNotification, as it travels. */
const bootAnswer = '[3,"1001",{"currentTime":"2026-11-12T09:00:00.188Z","interval":300,"status":"Accepted"}]';
/** When the lesson's clock starts: the WebSocket upgrade. */
const START = Date.parse("2026-11-12T09:00:00.000Z");

describe("OCPP over WebSocket", () => {
    it("frames the BootNotification as a masked text frame with a 16-bit length", () => {
        const bytes = bytesOf(frame("boot").fields!);
        expect(bytes[0], "FIN and opcode 1 (text)").toBe(0x81);
        expect(bytes[1]! & 0x80, "a client masks").toBe(0x80);
        expect(bytes[1]! & 0x7f, "126: the length follows in 2 bytes").toBe(126);
        expect((bytes[2]! << 8) | bytes[3]!).toBe(new TextEncoder().encode(wire(boot)).length);
        expect(bytes.slice(4), "a 4-byte masking key").toHaveLength(4);
        expect(0x5b ^ bytes[4]!, "the first byte, masked, as the note says").toBe(0x61);
    });

    it("frames the answer unmasked, with a 7-bit length", () => {
        const bytes = bytesOf(frame("boot-conf").fields!);
        expect(bytes[0]).toBe(0x81);
        expect(bytes[1]! & 0x80, "a server never masks").toBe(0);
        expect(bytes[1]).toBe(new TextEncoder().encode(bootAnswer).length);
        expect(bytes).toHaveLength(2);
    });

    it("answers the call with the same message id, and the interval the text gives", () => {
        const [type, id, action] = JSON.parse(boot) as [number, string, string];
        const [answerType, answerId, payload] = JSON.parse(bootAnswer) as [number, string, { interval: number; status: string }];
        expect([type, action, answerType, answerId]).toEqual([2, "BootNotification", 3, id]);
        expect(text.frames["boot-conf"]).toContain(`${payload.interval} s`);
        expect(payload.status).toBe("Accepted");
    });

    it("takes one message apart in the anatomy", () => {
        const [anatomy] = lesson.anatomy!;
        const message = JSON.parse(anatomy!.also!) as unknown[];
        expect(anatomy!.also).toBe(wire(boot));
        expect(anatomy!.parts.slice(0, 3).map(([part]) => part)).toEqual(message.slice(0, 3).map((element) => JSON.stringify(element)));
        expect(typeof message[3]).toBe("object");
    });
});

interface TransactionEvent {
    eventType: string;
    timestamp: string;
    seqNo: number;
    transactionInfo: { transactionId: string };
    meterValue: { sampledValue: { value: number; measurand: string }[] }[];
}

describe("the TransactionEvent sample", () => {
    const [type, id, action, payload] = JSON.parse(meter) as [number, string, string, TransactionEvent];

    it("is an Updated event of TX-0187 with the meter values the lesson shows", () => {
        expect([type, id, action]).toEqual([2, "1005", "TransactionEvent"]);
        expect(payload.eventType).toBe("Updated");
        expect(payload.seqNo).toBe(1);
        expect(payload.transactionInfo.transactionId).toBe("TX-0187");
        const [energy, power] = payload.meterValue[0]!.sampledValue;
        expect(energy).toMatchObject({ value: 15600, measurand: "Energy.Active.Import.Register" });
        expect(power).toMatchObject({ value: 3 * 230 * 16, measurand: "Power.Active.Import" });
        const row = lesson.points!.rows.find((item) => item.id === "energy")!;
        expect(row.values.find(([step]) => step === "charge")).toEqual(["charge", "15600 Wh", "15600 Wh"]);
    });

    it("was sent at the time of its frame, and the energy grows at 11.04 kW", () => {
        expect(Date.parse(payload.timestamp) - START).toBe(Number(frame("updated").time) * 1000);
        const hours = (from: string, to: string) => (Number(frame(to).time) - Number(frame(from).time)) / 3600;
        expect(12840 + 11040 * hours("started", "updated")).toBe(15600);
        expect(12840 + 11040 * hours("started", "ended")).toBe(23880);
        expect(23880 - 12840).toBe(11040);
    });
});

describe("the playground notes", () => {
    const expected: Record<string, string> = {
        call: "2,",
        "message-id": '"100',
        action: '"',
        reason: '"reason"',
        model: '"model"',
        firmware: '"firmwareVersion"',
        "event-type": '"eventType"',
        timestamp: '"timestamp"',
        trigger: '"triggerReason"',
        seq: '"seqNo"',
        "transaction-id": '"transactionId"',
        "charging-state": '"chargingState"',
        energy: '"value": 15600',
        measurand: '"measurand"',
        unit: '"unit": "Wh"',
        power: '"value": 11040',
    };
    it.each(lesson.playground!.map((item) => [item.kind === "file" ? item.sample : item.kind, item] as const))("%s: each note is on the line it explains", (_, item) => {
        if (item.kind !== "file") return;
        const lines = item.file.split("\n");
        for (const [line, note] of Object.entries(item.notes)) expect(lines[Number(line) - 1], `line ${line}: ${note}`).toContain(expected[note]);
    });
});
