import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/i18n/languages";
import { byteCount, sizeOf } from "@/viz/ByteInspector";
import { berProblems, checksum8, crc16Dnp, crc16Modbus } from "./bytes";
import { CATALOG } from "./catalog";
import type { Lesson, LessonText } from "./types";

const lessons = import.meta.glob<Lesson>("./*/lesson.ts", { eager: true, import: "lesson" });
const texts = import.meta.glob<LessonText>("./*/*.json", { eager: true, import: "default" });

const lessonOf = (id: string) => lessons[`./${id}/lesson.ts`]!;
const textOf = (id: string, lang = "en") => texts[`./${id}/${lang}.json`];

/** Every key the lesson's data points to in its texts, as paths: "steps.connect.title", "fields.start.note" … */
function referencedKeys(lesson: Lesson, optionalNotes = false): string[] {
    const keys = new Set<string>(["intro", "plain"]);
    for (const step of lesson.steps) keys.add(`steps.${step.id}.title`).add(`steps.${step.id}.text`);
    for (const frame of lesson.frames) {
        keys.add(`frames.${frame.id}`);
        if (!frame.fields?.length) keys.add(`notes.${frame.id}`);
        // A frame with bytes may have a note too
        else if (optionalNotes) keys.add(`notes.${frame.id}`);
        for (const [, , key] of frame.fields ?? []) keys.add(`fields.${key}.name`).add(`fields.${key}.note`);
    }
    for (const device of lesson.scene.devices) keys.add(`devices.${device.id}`);
    for (const fact of lesson.facts) keys.add(`facts.${fact}`);
    for (const row of lesson.points?.rows ?? []) {
        keys.add(`points.${row.id}`);
        for (const [, inDevice, inReceiver] of row.values) for (const value of [inDevice, inReceiver]) if (value.startsWith("~")) keys.add(`values.${value.slice(1)}`);
    }
    for (const anatomy of lesson.anatomy ?? []) {
        keys.add(`anatomy.${anatomy.id}`);
        for (const [, , key] of anatomy.parts) keys.add(`fields.${key}.name`).add(`fields.${key}.note`);
    }
    if (lesson.timing) {
        keys.add("timing.title").add("timing.note");
        for (const track of lesson.timing.tracks) {
            keys.add(`timing.${track.id}`);
            for (const event of track.events ?? []) if (event.label) keys.add(`timing.${event.label}`);
        }
    }
    if (lesson.singleLine) {
        for (const key of ["title", "bus", "transformer", "open", "fault", "station"]) keys.add(`singleLine.${key}`);
        if (lesson.singleLine.ieds.some((ied) => ied.bus === "process")) keys.add("singleLine.process");
        for (const feeder of lesson.singleLine.feeders) keys.add(`singleLine.${feeder.id}`);
    }
    for (const item of lesson.playground ?? []) {
        keys.add(`playground.${item.intro ?? item.kind}`);
        if (item.kind === "file") for (const note of Object.values(item.notes)) keys.add(`playground.${note}`);
    }
    return [...keys];
}

/** Every leaf of a text file as a path, with its text: arrays by index ("tips.0"). */
function leaves(value: unknown, path = ""): [string, string][] {
    if (typeof value === "string") return [[path, value]];
    if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, `${path}.${i}`));
    if (value && typeof value === "object") return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
    return [[path, String(value)]];
}

const get = (text: unknown, path: string) => path.split(".").reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], text);

describe("the catalog", () => {
    it("has 43 protocols with unique ids, each with a lesson and English texts", () => {
        expect(CATALOG).toHaveLength(43);
        expect(new Set(CATALOG.map((meta) => meta.id)).size).toBe(CATALOG.length);
        for (const meta of CATALOG) {
            expect(lessons[`./${meta.id}/lesson.ts`], `${meta.id}/lesson.ts`).toBeDefined();
            expect(textOf(meta.id), `${meta.id}/en.json`).toBeDefined();
        }
    });
});

describe.each(CATALOG.map((meta) => meta.id).filter((id) => lessons[`./${id}/lesson.ts`]))("the %s lesson", (id) => {
    const lesson = lessonOf(id);
    const english = textOf(id)!;
    const devices = new Set(lesson.scene.devices.map((device) => device.id));
    const steps = lesson.steps.map((step) => step.id);

    it("has steps, each with at least one frame, between devices of its scene", () => {
        expect(steps.length, "steps").toBeGreaterThanOrEqual(3);
        expect(new Set(steps).size, "unique step ids").toBe(steps.length);
        expect(new Set(lesson.frames.map((frame) => frame.id)).size, "unique frame ids").toBe(lesson.frames.length);
        for (const step of steps) expect(lesson.frames.some((frame) => frame.step === step), `a frame in step ${step}`).toBe(true);
        let last = 0;
        for (const frame of lesson.frames) {
            const index = steps.indexOf(frame.step);
            expect(index, `${frame.id}: its step`).toBeGreaterThanOrEqual(last);
            last = index;
            for (const device of [frame.from, ...(typeof frame.to === "string" ? [frame.to] : frame.to)]) {
                expect(devices.has(device), `${frame.id}: ${device} is in the scene`).toBe(true);
                expect(lesson.actors, `${frame.id}: ${device} is a column of the sequence view`).toContain(device);
            }
            if (frame.link) expect(lesson.scene.links.map((link) => link.id), `${frame.id}: its link`).toContain(frame.link);
            if (frame.size) expect(frame.size, `${frame.id}: its size is more than the bytes shown`).toBeGreaterThan(sizeOf(frame.fields ?? []));
        }
    });

    it("writes every field as hex bytes", () => {
        for (const frame of lesson.frames) for (const [hex, , key] of frame.fields ?? []) expect(byteCount(hex), `${frame.id} ${key}: "${hex}"`).toBeGreaterThan(0);
    });

    it("links devices that are in its scene, and points to lessons that exist", () => {
        expect(devices.size, "unique device ids").toBe(lesson.scene.devices.length);
        for (const link of lesson.scene.links) {
            expect(devices.has(link.from), `${link.id}.from`).toBe(true);
            expect(devices.has(link.to), `${link.id}.to`).toBe(true);
        }
        for (const related of lesson.related ?? []) expect(CATALOG.map((meta) => meta.id)).toContain(related);
        for (const row of lesson.points?.rows ?? []) for (const [step] of row.values) expect(steps, `points ${row.id}`).toContain(step);
        if (lesson.points) expect(devices.has(lesson.points.device) && devices.has(lesson.points.receiver), "points devices").toBe(true);
        for (const state of lesson.singleLine?.states ?? []) expect(steps, "single-line state").toContain(state.step);
        for (const ied of [...(lesson.singleLine?.ieds.map((item) => item.id) ?? []), ...(lesson.singleLine?.extras ?? [])]) expect(english.devices[ied], `single-line box ${ied} has a name`).toBeTruthy();
    });

    it("has an English text for everything its data names", () => {
        for (const key of referencedKeys(lesson)) {
            const value = get(english, key);
            expect(typeof value === "string" && value.trim().length > 0, `en.json: ${key}`).toBe(true);
        }
        expect(english.tips.length, "tips").toBeGreaterThanOrEqual(2);
    });

    it("has no English text its data does not use", () => {
        const used = new Set(referencedKeys(lesson, true));
        for (const [path] of leaves(english)) {
            if (path === "intro" || path === "plain" || path.startsWith("tips.")) continue;
            expect(used.has(path), `en.json: ${path} is not used`).toBe(true);
        }
    });

    it.each(LANGUAGES.filter((language) => language.code !== "en").map((language) => language.code))("is translated into %s, with the same texts and placeholders", (code) => {
        const text = textOf(id, code);
        if (!text) return expect.soft(text, `${id}/${code}.json is missing`).toBeDefined();
        const theirs = new Map(leaves(text));
        for (const [path, value] of leaves(english)) {
            const translated = theirs.get(path);
            expect(translated?.trim(), `${code}: ${path}`).toBeTruthy();
            // Numbers, hex and technical names must survive translation unchanged
            const keep = (s: string) => (s.match(/0x[0-9A-F]+|\b[0-9A-F]{2}(?: [0-9A-F]{2})+\b/g) ?? []).sort();
            expect(keep(translated ?? ""), `${code}: ${path} keeps its hex`).toEqual(keep(value));
        }
        expect(theirs.size, `${code}: no extra texts`).toBe(leaves(english).length);
    });
});

describe("the byte checks", () => {
    const ascii = [..."123456789"].map((char) => char.charCodeAt(0));
    it("compute the standard check values", () => {
        expect(crc16Modbus(ascii)).toBe(0x4b37);
        expect(crc16Dnp(ascii)).toBe(0xea82);
        expect(checksum8([0x53, 0x01])).toBe(0x54);
    });
    it("find BER lengths that do not add up", () => {
        expect(berProblems([0x30, 0x03, 0x02, 0x01, 0x05])).toEqual([]);
        expect(berProblems([0x30, 0x04, 0x02, 0x01, 0x05])).not.toEqual([]);
    });
});
