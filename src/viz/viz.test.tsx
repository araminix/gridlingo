import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/i18n";
import english from "@/lessons/iec-61850-goose/en.json";
import { lesson as goose } from "@/lessons/iec-61850-goose/lesson";
import { lesson as iec104 } from "@/lessons/iec-104/lesson";
import english104 from "@/lessons/iec-104/en.json";
import type { Lesson, LessonText } from "@/lessons/types";
import { wordsOf } from "@/lessons/words";
import { HERO } from "@/pages/Home";
import { ByteInspector, byteCount, sizeOf } from "./ByteInspector";
import { valuesAt } from "./DeviceState";
import { SequenceDiagram } from "./SequenceDiagram";
import { stateAt } from "./SingleLine";
import { bodyOf } from "./devices";
import { GRID } from "./iso";
import { groundOf, SiteScene } from "./SiteScene";
import { StepCaption, StepControls, StepStrip } from "./StepPlayer";

const words104 = wordsOf(english104 as LessonText, english104 as LessonText);
const wordsGoose = wordsOf(english as LessonText, english as LessonText);
const frame = (lesson: typeof goose, id: string) => lesson.frames.find((item) => item.id === id)!;
const inEnglish = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

describe("the byte inspector", () => {
    it("counts hex bytes and only hex bytes", () => {
        expect(byteCount("68 04 07 00")).toBe(4);
        expect(byteCount("6804")).toBe(0);
        expect(byteCount("hello")).toBe(0);
        expect(sizeOf(frame(iec104, "measured").fields!)).toBe(28);
    });

    it("shows each field with its name and meaning, and the colours it uses", async () => {
        inEnglish(<ByteInspector frame={frame(iec104, "gi-act")} words={words104} />);
        const bytes = await screen.findByRole("list", { name: "Bytes" });
        expect(within(bytes).getAllByRole("listitem")).toHaveLength(9);
        expect(within(bytes).getByText("64")).toBeTruthy();
        expect(screen.getByText(/C_IC_NA_1: the interrogation command/)).toBeTruthy();
        const legend = screen.getByRole("list", { name: "What the colors mean" });
        expect(within(legend).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Framing", "Control", "Type", "Count", "Reason", "Address", "Value"]);
    });

    it("explains a frame without bytes in words", () => {
        inEnglish(<ByteInspector frame={frame(iec104, "tcp")} words={words104} />);
        expect(screen.getByText("Open a TCP connection to port 2404")).toBeTruthy();
        expect(screen.getByText(/The RTU accepts the connection and waits/)).toBeTruthy();
    });
});

describe("the site", () => {
    it("sends a multicast to every subscriber, through the switch", () => {
        const { container } = inEnglish(<SiteScene scene={goose.scene} frame={frame(goose, "event")} words={wordsGoose} />);
        expect(container.querySelectorAll("[data-token]")).toHaveLength(3);
        const motions = [...container.querySelectorAll("animateMotion")].map((motion) => motion.getAttribute("path")!.split("L").length);
        // relay → switch is one link of 3 points; switch → each subscriber adds 2 more
        for (const points of motions) expect(points).toBeGreaterThanOrEqual(5);
    });

    it("names every device", () => {
        inEnglish(<SiteScene scene={iec104.scene} frame={undefined} words={words104} />);
        for (const name of ["SCADA master", "RTU", "PV inverter", "Battery", "Breaker CB-1"]) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    });
});

describe("the sequence view", () => {
    it("draws one row per frame, the chosen one pressed", () => {
        const onSelect = vi.fn();
        inEnglish(<SequenceDiagram actors={iec104.actors} frames={iec104.frames.slice(0, 4)} selected="gi-act" onSelect={onSelect} words={words104} />);
        const rows = screen.getAllByRole("button");
        expect(rows).toHaveLength(4);
        expect(rows[3]!.getAttribute("aria-pressed")).toBe("true");
        fireEvent.click(rows[1]!);
        expect(onSelect).toHaveBeenCalledWith("startdt-act");
    });
});

describe("the step player", () => {
    it("marks the current step and moves on", () => {
        const onGo = vi.fn();
        inEnglish(<StepStrip steps={iec104.steps} current={2} onGo={onGo} words={words104} />);
        const current = screen.getByRole("button", { current: "step" });
        expect(current.textContent).toContain("Ask for everything");
        fireEvent.click(screen.getByRole("button", { name: /A breaker trips/ }));
        expect(onGo).toHaveBeenCalledWith(5);
    });

    it("tells the step in words and cannot go before the first", async () => {
        const onGo = vi.fn();
        inEnglish(
            <>
                <StepControls current={0} last={5} playing={false} onGo={onGo} onPlay={() => {}} />
                <StepCaption steps={iec104.steps} current={0} wire="SYN · SYN-ACK · ACK" words={words104} />
            </>,
        );
        expect(await screen.findByText(/Step 1 of 6/)).toBeTruthy();
        expect((screen.getByRole("button", { name: "Previous step" }) as HTMLButtonElement).disabled).toBe(true);
        act(() => screen.getByRole("button", { name: "Next step" }).click());
        expect(onGo).toHaveBeenCalledWith(1);
    });
});

describe("state by step", () => {
    it("gives each signal the value of the last step that set it", () => {
        const breaker = iec104.points!.rows.find((row) => row.id === "cb")!;
        expect(valuesAt(breaker, iec104.steps, 0)).toEqual({ inDevice: "~closed", inReceiver: "–" });
        expect(valuesAt(breaker, iec104.steps, 4)).toEqual({ inDevice: "~closed", inReceiver: "~closed" });
        expect(valuesAt(breaker, iec104.steps, 5)).toEqual({ inDevice: "~open", inReceiver: "~open" });
    });

    it("opens the breaker in the single-line diagram once it has tripped", () => {
        expect(stateAt(goose.singleLine!, goose.steps, 1).fault).toBe("f1");
        expect(stateAt(goose.singleLine!, goose.steps, 5).open).toEqual(["f1"]);
    });
});

describe("the ground", () => {
    const lessons = import.meta.glob<Lesson>("../lessons/*/lesson.ts", { eager: true, import: "lesson" });
    const scenes = [{ name: "the home page's plate", scene: HERO, margin: 0.75 }, ...Object.entries(lessons).map(([path, lesson]) => ({ name: path, scene: lesson.scene, margin: 1.5 }))];

    it.each(scenes)("holds every device of $name", ({ scene, margin }) => {
        const { x0, x1, y0, y1 } = groundOf(scene, margin);
        for (const device of scene.devices)
            for (const part of bodyOf(device.kind, device.at[0] * GRID, device.at[1] * GRID)) {
                expect(part.cx - part.w / 2, device.id).toBeGreaterThanOrEqual(x0 * GRID);
                expect(part.cx + part.w / 2, device.id).toBeLessThanOrEqual(x1 * GRID);
                expect(part.cy - part.d / 2, device.id).toBeGreaterThanOrEqual(y0 * GRID);
                expect(part.cy + part.d / 2, device.id).toBeLessThanOrEqual(y1 * GRID);
            }
    });
});
