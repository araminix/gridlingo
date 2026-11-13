import { describe, expect, it } from "vitest";
import { lesson } from "./lesson";
import equipment from "./tso-a-eq.xml?raw";

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const CIM = "http://iec.ch/TC57/2013/CIM-schema-cim16#";
const document = new DOMParser().parseFromString(equipment, "application/xml");
const objects = [...document.documentElement.children].filter((element) => element.namespaceURI === CIM);
const idOf = (element: Element) => element.getAttributeNS(RDF, "ID");
const reference = (element: Element, name: string) => element.getElementsByTagNameNS(CIM, name)[0]?.getAttributeNS(RDF, "resource");
const value = (element: Element, name: string) => Number(element.getElementsByTagNameNS(CIM, name)[0]?.textContent);
const byClass = (name: string) => objects.find((element) => element.localName === name)!;

describe("the CGMES equipment extract", () => {
    it("is well-formed RDF/XML with a model header", () => {
        expect(document.getElementsByTagName("parsererror")).toHaveLength(0);
        expect(document.documentElement.localName).toBe("RDF");
        expect(document.getElementsByTagNameNS("http://iec.ch/TC57/61970-552/ModelDescription/1#", "FullModel")).toHaveLength(1);
    });

    it("names every object by an underscore and a version 4 UUID", () => {
        for (const object of objects) expect(idOf(object), object.localName).toMatch(/^_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it("links the terminal to the line and the line to its base voltage, by their IDs", () => {
        const [line, terminal, base] = [byClass("ACLineSegment"), byClass("Terminal"), byClass("BaseVoltage")];
        expect(reference(terminal, "Terminal.ConductingEquipment")).toBe(`#${idOf(line)}`);
        expect(reference(line, "ConductingEquipment.BaseVoltage")).toBe(`#${idOf(base)}`);
        expect(value(base, "BaseVoltage.nominalVoltage")).toBe(380);
    });

    it("gives the line values per km that are usual for 380 kV, as the notes say", () => {
        const line = byClass("ACLineSegment");
        const km = value(line, "Conductor.length");
        expect(value(line, "ACLineSegment.r") / km).toBeCloseTo(0.03, 3);
        expect(value(line, "ACLineSegment.x") / km).toBeCloseTo(0.32, 2);
        expect((value(line, "ACLineSegment.bch") / km) * 1e6, "µS per km").toBeCloseTo(3.6, 1);
    });

    it("takes apart the terminal's link to the line in the anatomy", () => {
        const [prefix, name, role, target] = lesson.anatomy![0]!.parts.map(([text]) => text);
        expect(`${prefix}${name}${role}`).toBe("cim:Terminal.ConductingEquipment");
        expect(target).toBe(reference(byClass("Terminal"), "Terminal.ConductingEquipment"));
        expect(equipment).toContain(lesson.anatomy![0]!.also!);
    });
});
