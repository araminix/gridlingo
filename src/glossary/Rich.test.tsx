import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GlossaryProvider, Rich } from "./Rich";

const glossary = {
    ACK: { full: "Acknowledgment", plain: 'A short reply that means "I got it".' },
    CF: { full: "Configuration", plain: "The group of settings." },
    IEC: { full: "International Electrotechnical Commission", plain: "The body that writes these standards." },
};
const show = (text: string) =>
    render(
        <GlossaryProvider glossary={glossary}>
            <p>
                <Rich text={text} />
            </p>
        </GlossaryProvider>,
    );

afterEach(cleanup);

describe("a text with glossary terms", () => {
    it("marks each term once, where it first appears, and explains it on a click", () => {
        show("The RTU answers with an ACK. Each ACK counts.");
        const terms = screen.getAllByRole("button", { name: "ACK" });
        expect(terms).toHaveLength(1);
        fireEvent.click(terms[0]!);
        expect(screen.getByText("Acknowledgment")).toBeTruthy();
        expect(screen.getByText(/I got it/)).toBeTruthy();
    });

    it("leaves bytes and standard numbers alone", () => {
        show("The bytes 01 CF 0E 10 are a timestamp; IEC 61850 names its values; CF holds settings; the IEC wrote it.");
        expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["CF", "IEC"]);
        expect(screen.getByText(/01 CF 0E 10/)).toBeTruthy();
    });

    it("shows plain text when there is no glossary", () => {
        render(
            <p>
                <Rich text="An ACK." />
            </p>,
        );
        expect(screen.queryByRole("button")).toBeNull();
    });
});
