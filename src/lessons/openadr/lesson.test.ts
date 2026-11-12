import { describe, expect, it } from "vitest";
import text from "./en.json";
import { lesson } from "./lesson";
import event from "./event.xml?raw";

const OADR = "http://openadr.org/oadr-2.0b/2012/07";
const EI = "http://docs.oasis-open.org/ns/energyinterop/201110";
const XCAL = "urn:ietf:params:xml:ns:icalendar-2.0";

const frame = (id: string) => lesson.frames.find((item) => item.id === id)!;

describe("the OpenADR 2.0b event sample", () => {
    const xml = new DOMParser().parseFromString(event, "application/xml");
    // Only the elements that hold a value: xcal:duration wraps another xcal:duration
    const all = (ns: string, name: string) =>
        Array.from(xml.getElementsByTagNameNS(ns, name))
            .filter((element) => element.childElementCount === 0)
            .map((element) => element.textContent?.trim());
    const one = (ns: string, name: string) => all(ns, name)[0];

    it("is a well-formed oadrPayload holding an oadrDistributeEvent", () => {
        expect(xml.getElementsByTagName("parsererror")).toHaveLength(0);
        expect(xml.documentElement.localName).toBe("oadrPayload");
        expect(xml.documentElement.namespaceURI).toBe(OADR);
        const distribute = xml.getElementsByTagNameNS(OADR, "oadrDistributeEvent")[0]!;
        expect(distribute.getAttributeNS(EI, "schemaVersion")).toBe("2.0b");
        expect(one(OADR, "oadrResponseRequired")).toBe("always");
    });

    it("asks for level 1 of the SIMPLE signal, for one hour from 17:00 UTC", () => {
        expect(one(EI, "signalName")).toBe("SIMPLE");
        expect(one(EI, "signalType")).toBe("level");
        expect(all(EI, "value")).toEqual(["1.0", "0.0"]);
        expect(one(XCAL, "date-time")).toBe("2026-07-15T17:00:00Z");
        expect(all(XCAL, "duration").filter((value) => value === "PT1H")).toHaveLength(2);
        expect(one(EI, "eventStatus")).toBe("far");
        expect(one(EI, "venID")).toBe("VEN-BLDG-7");
    });

    it("puts the frames at the times the event names", () => {
        // The first poll is at 12:00 UTC: the event starts 5 hours later and lasts one
        const poll = Date.parse("2026-07-15T12:00:00Z") / 1000;
        const start = Date.parse(one(XCAL, "date-time")!) / 1000;
        expect(Number(frame("shed").time)).toBe(start - poll);
        expect(Number(frame("restore").time)).toBe(start - poll + 3600);
        expect(Date.parse(one(EI, "createdDateTime")!) / 1000).toBeLessThan(poll);
    });

    it("names the event the VEN answers", () => {
        expect(text.notes.created).toContain(one(EI, "eventID")!);
        expect(text.notes.created).toContain(`modificationNumber ${one(EI, "modificationNumber")}`);
    });

    it("marks lines of the sample that hold what the notes explain", () => {
        const lines = event.split("\n");
        const file = lesson.playground!.find((item) => item.kind === "file")!;
        const expected: Record<string, string> = { "event-id": "eventID", modification: "modificationNumber", status: "eventStatus", start: "date-time", level: "1.0", simple: "SIMPLE", current: "0.0", target: "venID", response: "oadrResponseRequired" };
        if (file.kind !== "file") throw new Error("a file playground");
        for (const [line, note] of Object.entries(file.notes)) if (expected[note]) expect(lines[Number(line) - 1], `line ${line}`).toContain(expected[note]);
    });
});
