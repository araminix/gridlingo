import { describe, expect, it } from "vitest";
import en from "@/i18n/locales/en.json";
import type { Lesson } from "@/lessons/types";
import { COLUMNS } from "./Compare";
import { COMPARED, MAX_COMPARED, compareFrom, pickedFrom } from "./compared";

const lessons = import.meta.glob<Lesson>("../lessons/*/lesson.ts", { eager: true, import: "lesson" });
const bytesOf = (hex: string) => hex.split(" ").map((pair) => parseInt(pair, 16));

describe("the comparison page", () => {
    it("has a column for every protocol it offers, in the same order", () => {
        expect(COLUMNS.map((column) => column.lesson)).toEqual(COMPARED);
    });

    it("takes each frame from its lesson, or gives its own bytes", () => {
        for (const column of COLUMNS) {
            if (column.frame === null) {
                expect(column.own?.length, column.lesson).toBeGreaterThan(0);
                continue;
            }
            const frame = lessons[`../lessons/${column.lesson}/lesson.ts`]!.frames.find((item) => item.id === column.frame);
            expect(frame?.fields?.length, `${column.lesson} ${column.frame}`).toBeGreaterThan(0);
        }
    });

    it("has words for exactly the facts a frame carries", () => {
        for (const column of COLUMNS)
            for (const fact of ["time", "quality", "reason"] as const) expect(`compare.${column.lesson}.${fact}` in en, `${column.lesson} ${fact}`).toBe(column.carries.includes(fact));
    });

    it("answers the Modbus poll with a frame whose MBAP length counts the bytes after it", () => {
        const fields = COLUMNS.find((column) => column.lesson === "modbus-tcp")!.own!;
        const bytes = fields.flatMap(([hex]) => bytesOf(hex));
        expect(bytes.map((byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join(" ")).toBe("00 05 00 00 00 04 01 02 01 00");
        // Transaction (2), protocol (2) and length (2) come first; the length covers the rest
        expect((bytes[4]! << 8) | bytes[5]!).toBe(bytes.length - 6);
        // FC 02's byte count matches the input bytes that follow it
        expect(bytes[8]).toBe(bytes.length - 9);
    });

    it("reads the choice from the address: known protocols, in the page's order, at most four", () => {
        expect(pickedFrom("")).toEqual(["iec-61850-goose", "iec-104", "dnp3", "modbus-tcp"]);
        expect(pickedFrom("?p=modbus-tcp,nothing,iec-101")).toEqual(["iec-101", "modbus-tcp"]);
        expect(pickedFrom(`?p=${[...COMPARED].reverse().join(",")}`)).toEqual(COMPARED.slice(0, MAX_COMPARED));
        expect(pickedFrom("?p=nothing")).toEqual(pickedFrom(""));
    });

    it("opens from a lesson with that lesson's protocol among the ones shown", () => {
        for (const id of COMPARED) {
            const picked = pickedFrom(compareFrom(id).replace("/compare", ""));
            expect(picked, id).toContain(id);
            expect(picked, id).toHaveLength(MAX_COMPARED);
        }
        expect(compareFrom("dnp3")).toBe("/compare");
    });
});
