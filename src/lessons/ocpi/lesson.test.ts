import { describe, expect, it } from "vitest";
import cdrFile from "./cdr.json?raw";
import { lesson } from "./lesson";
import locationFile from "./location.json?raw";

const location = JSON.parse(locationFile);
const cdr = JSON.parse(cdrFile);
const anatomy = (id: string) => lesson.anatomy!.find((item) => item.id === id)!;
const parts = (id: string) => anatomy(id).parts.map(([part]) => part);
const point = (id: string, step: string) => lesson.points!.rows.find((row) => row.id === id)!.values.find(([at]) => at === step)!;

describe("the location", () => {
    const [evse] = location.evses;
    const [connector] = evse.connectors;

    it("has the EVSE ID the anatomy takes apart: country, operator, E, EVSE", () => {
        const [country, operator, type, number] = parts("evse-id");
        expect(`${country}*${operator}*${type}${number}`).toBe(anatomy("evse-id").also);
        expect(evse.evse_id).toBe(anatomy("evse-id").also);
        expect([country, operator]).toEqual([location.country_code, location.party_id]);
        expect(lesson.scene.devices.find((device) => device.id === "charger")!.address).toBe(evse.evse_id);
    });

    it("is put at the URL the anatomy takes apart", () => {
        expect(parts("url").join("/")).toBe(anatomy("url").also);
        expect(parts("url").slice(1)).toEqual([location.country_code, location.party_id, location.id]);
        expect(lesson.frames.find((frame) => frame.id === "put-location")!.name).toContain(parts("url").slice(1).join("/"));
    });

    it("has coordinates as strings with 5 to 7 decimals, and a power that adds up", () => {
        expect(location.coordinates.latitude).toMatch(/^-?\d{1,2}\.\d{5,7}$/);
        expect(location.coordinates.longitude).toMatch(/^-?\d{1,3}\.\d{5,7}$/);
        expect(location.country).toHaveLength(3);
        expect(location.country_code).toHaveLength(2);
        expect(connector.max_electric_power).toBe(3 * connector.max_voltage * connector.max_amperage);
    });
});

describe("the CDR", () => {
    const [period] = cdr.charging_periods;
    const volume = (type: string) => period.dimensions.find((dimension: { type: string }) => dimension.type === type).volume;

    it("bills the charge of the location and the card of this lesson", () => {
        expect(cdr.cdr_location.id).toBe(location.id);
        expect(cdr.cdr_location.evse_id).toBe(location.evses[0].evse_id);
        expect(cdr.cdr_location.evse_uid).toBe(location.evses[0].uid);
        expect(lesson.frames.find((frame) => frame.id === "authorize")!.name).toContain(cdr.cdr_token.uid);
        expect(lesson.frames.find((frame) => frame.id === "put-session")!.name).toContain(cdr.session_id);
    });

    it("adds up: energy, time and price", () => {
        const hours = (Date.parse(cdr.end_date_time) - Date.parse(cdr.start_date_time)) / 3_600_000;
        expect(cdr.total_time).toBe(hours);
        expect(volume("TIME")).toBe(hours);
        expect(volume("ENERGY")).toBe(cdr.total_energy);
        expect(cdr.total_energy * 0.4).toBeCloseTo(cdr.total_cost.excl_vat, 9);
        expect(Math.round(cdr.total_cost.excl_vat * 1.21 * 100) / 100).toBe(cdr.total_cost.incl_vat);
        expect(point("kwh", "cdr")).toEqual(["cdr", String(cdr.total_energy), String(cdr.total_energy)]);
        expect(point("cost", "cdr")[1]).toBe(`${cdr.total_cost.incl_vat} ${cdr.currency}`);
    });
});

describe("the playground notes", () => {
    const expected: Record<string, string> = {
        owner: '"country_code": "NL"',
        "location-id": '"id": "LOC-0042"',
        publish: '"publish"',
        country: '"country": "NLD"',
        coordinates: '"latitude"',
        "evse-uid": '"uid"',
        "evse-id": '"evse_id"',
        status: '"status"',
        standard: '"standard"',
        "max-voltage": '"max_voltage": 230',
        "max-power": '"max_electric_power": 22080',
        tariff: '"tariff_ids"',
        "time-zone": '"time_zone"',
        "last-updated": '"last_updated"',
        "cdr-id": '"id": "CDR-0187"',
        "session-id": '"session_id"',
        "cdr-token": '"cdr_token"',
        contract: '"contract_id"',
        "auth-method": '"auth_method": "AUTH_REQUEST"',
        "cdr-location": '"cdr_location"',
        currency: '"currency": "EUR"',
        periods: '"charging_periods"',
        dimensions: '"ENERGY", "volume": 12.5',
        "excl-vat": '"excl_vat": 5.00',
        "incl-vat": '"incl_vat": 6.05',
        "total-energy": '"total_energy"',
        "total-time": '"total_time": 1.25',
    };
    it.each(lesson.playground!.map((item) => [item.kind === "file" ? item.sample : item.kind, item] as const))("%s: each note is on the line it explains", (_, item) => {
        if (item.kind !== "file") return;
        const lines = item.file.split("\n");
        for (const [line, note] of Object.entries(item.notes)) expect(lines[Number(line) - 1], `line ${line}: ${note}`).toContain(expected[note]);
    });
});
