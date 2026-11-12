import { describe, expect, it } from "vitest";
import substation from "@/lessons/iec-61850-goose/substation.scd?raw";
import inverter from "@/lessons/iec-61850-mms/pv-inverter.cid?raw";
import { filterTree, parseScl, type SclNode } from "./scl";

const find = (nodes: SclNode[], name: string): SclNode | undefined => {
    for (const node of nodes) {
        if (node.name === name) return node;
        const found = find(node.children, name);
        if (found) return found;
    }
};

describe("the SCL reader", () => {
    it("builds the tree of a device: logical devices, nodes, objects and the values the file sets", () => {
        const result = parseScl(inverter);
        if (!result.ok) throw new Error(result.error);
        expect(result.ieds.map((ied) => ied.name)).toEqual(["PV1"]);
        expect(find(result.ieds, "S1")?.detail).toBe("10.0.0.31");
        const mmxu = find(result.ieds, "MMXU1")!;
        expect(mmxu.lnClass).toBe("MMXU");
        const totW = find(mmxu.children, "TotW")!;
        expect(totW.detail).toBe("MV");
        expect(find(totW.children, "mag")?.fc).toBe("MX");
        expect(find(find(totW.children, "units")!.children, "multiplier")?.value).toBe("k");
    });

    it("shows data sets, control blocks with their addresses, and subscriptions", () => {
        const result = parseScl(substation);
        if (!result.ok) throw new Error(result.error);
        expect(find(result.ieds, "dsTrip")?.children.map((fcda) => fcda.name)).toEqual(["LD0/PTRC1.Tr.general", "LD0/PTRC1.Tr.q"]);
        expect(find(result.ieds, "gcbTrip")?.detail).toBe("GSEControl · datSet dsTrip · 01-0C-CD-01-00-01 · APPID 0001 · VLAN 00A");
        const input = find(result.ieds, "RBRF1")!.children.find((child) => child.kind === "IN");
        expect(input?.name).toBe("F1PROTLD0/PTRC1.Tr.general");
        expect(input?.detail).toBe("GOOSE · gcbTrip");
    });

    it("keeps only the branches that lead to a match", () => {
        const result = parseScl(inverter);
        if (!result.ok) throw new Error(result.error);
        const shown = filterTree(result.ieds, "wrtg");
        expect(find(shown, "ZINV1")).toBeDefined();
        expect(find(shown, "MMXU1")).toBeUndefined();
    });

    it("refuses what is not XML, or not SCL", () => {
        expect(parseScl("<SCL><IED></SCL>")).toEqual({ ok: false, error: "xml" });
        expect(parseScl("<svg xmlns='http://www.w3.org/2000/svg'/>")).toEqual({ ok: false, error: "scl" });
    });
});
