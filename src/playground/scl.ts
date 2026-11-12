/**
 * Reads an IEC 61850 SCL file (.icd, .cid, .scd …) into a tree a person can walk: IED → logical device → logical node →
 * data object → data attribute, with the values the file sets, its data sets and its control blocks. Only text is
 * read; nothing in the file runs. "IN" nodes are a logical node's inputs: what it subscribes to.
 */

export type SclKind = "IED" | "AP" | "LD" | "LN" | "DO" | "DA" | "DS" | "CB" | "IN";

export interface SclNode {
    kind: SclKind;
    name: string;
    /** The LN class ("MMXU"), for its meaning. */
    lnClass?: string;
    detail?: string;
    fc?: string;
    value?: string;
    children: SclNode[];
}

export type SclResult = { ok: true; ieds: SclNode[] } | { ok: false; error: "xml" | "scl" };

const elements = (parent: Element, name: string) => Array.from(parent.children).filter((child) => child.localName === name);
const first = (parent: Element, name: string) => elements(parent, name)[0];
const attr = (element: Element, name: string) => element.getAttribute(name) ?? "";

interface Templates {
    lnTypes: Map<string, Element>;
    doTypes: Map<string, Element>;
    daTypes: Map<string, Element>;
}

/** The attributes of a data attribute type, and of their structures in turn, as nodes. */
function attributeNodes(templates: Templates, typeId: string, values: Map<string, string>, path: string, depth: number): SclNode[] {
    const type = templates.daTypes.get(typeId);
    if (!type || depth > 6) return [];
    return elements(type, "BDA").map((bda) => {
        const name = attr(bda, "name");
        const full = `${path}.${name}`;
        return {
            kind: "DA",
            name,
            detail: attr(bda, "bType"),
            ...(values.has(full) ? { value: values.get(full)! } : {}),
            children: attr(bda, "bType") === "Struct" ? attributeNodes(templates, attr(bda, "type"), values, full, depth + 1) : [],
        };
    });
}

/** The data objects of a DO type (and their sub-objects), with the values the instance sets. */
function objectNodes(templates: Templates, typeId: string, values: Map<string, string>, path: string, depth: number): SclNode[] {
    const type = templates.doTypes.get(typeId);
    if (!type || depth > 6) return [];
    return Array.from(type.children).flatMap((child): SclNode[] => {
        const name = attr(child, "name");
        const full = `${path}.${name}`;
        if (child.localName === "SDO") return [{ kind: "DO", name, detail: templates.doTypes.get(attr(child, "type"))?.getAttribute("cdc") ?? "", children: objectNodes(templates, attr(child, "type"), values, full, depth + 1) }];
        if (child.localName !== "DA") return [];
        return [
            {
                kind: "DA",
                name,
                fc: attr(child, "fc"),
                detail: attr(child, "bType"),
                ...(values.has(full) ? { value: values.get(full)! } : (first(child, "Val")?.textContent ? { value: first(child, "Val")!.textContent!.trim() } : {})),
                children: attr(child, "bType") === "Struct" ? attributeNodes(templates, attr(child, "type"), values, full, depth + 1) : [],
            },
        ];
    });
}

/** The values set in an LN instance: "TotW.units.multiplier" → "k". */
function instanceValues(ln: Element) {
    const values = new Map<string, string>();
    const walk = (element: Element, path: string) => {
        for (const child of Array.from(element.children)) {
            if (child.localName !== "DOI" && child.localName !== "SDI" && child.localName !== "DAI") continue;
            const full = path ? `${path}.${attr(child, "name")}` : attr(child, "name");
            if (child.localName === "DAI") {
                const val = first(child, "Val")?.textContent?.trim();
                if (val) values.set(full, val);
            } else walk(child, full);
        }
    };
    walk(ln, "");
    return values;
}

export function parseScl(xml: string): SclResult {
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return { ok: false, error: "xml" };
    const root = doc.documentElement;
    if (root.localName !== "SCL") return { ok: false, error: "scl" };

    const templatesElement = first(root, "DataTypeTemplates");
    const index = (name: string) => new Map((templatesElement ? elements(templatesElement, name) : []).map((element) => [attr(element, "id"), element]));
    const templates: Templates = { lnTypes: index("LNodeType"), doTypes: index("DOType"), daTypes: index("DAType") };

    // The network addresses of each access point and of each GOOSE and sampled-value control block
    const ips = new Map<string, string>();
    const blocks = new Map<string, string>();
    const communication = first(root, "Communication");
    for (const subNetwork of communication ? elements(communication, "SubNetwork") : []) {
        for (const ap of elements(subNetwork, "ConnectedAP")) {
            const ip = Array.from(first(ap, "Address")?.children ?? []).find((p) => attr(p, "type") === "IP")?.textContent;
            if (ip) ips.set(`${attr(ap, "iedName")}/${attr(ap, "apName")}`, ip.trim());
            for (const block of [...elements(ap, "GSE"), ...elements(ap, "SMV")]) {
                const parts = Array.from(first(block, "Address")?.children ?? []);
                const get = (type: string) => parts.find((p) => attr(p, "type") === type)?.textContent?.trim();
                blocks.set(`${attr(ap, "iedName")}/${attr(block, "ldInst")}/${attr(block, "cbName")}`, [get("MAC-Address"), get("APPID") && `APPID ${get("APPID")}`, get("VLAN-ID") && `VLAN ${get("VLAN-ID")}`].filter(Boolean).join(" · "));
            }
        }
    }

    const ieds = elements(root, "IED").map((ied): SclNode => {
        const iedName = attr(ied, "name");
        return {
            kind: "IED",
            name: iedName,
            detail: [attr(ied, "manufacturer"), attr(ied, "type")].filter(Boolean).join(" · "),
            children: elements(ied, "AccessPoint").map((ap) => {
                const server = first(ap, "Server");
                return {
                    kind: "AP",
                    name: attr(ap, "name"),
                    detail: ips.get(`${iedName}/${attr(ap, "name")}`) ?? "",
                    children: (server ? elements(server, "LDevice") : []).map((ld) => {
                        const ldInst = attr(ld, "inst");
                        return {
                            kind: "LD",
                            name: `${iedName}${ldInst}`,
                            detail: attr(ld, "desc"),
                            children: [...elements(ld, "LN0"), ...elements(ld, "LN")].map((ln): SclNode => {
                                const lnClass = attr(ln, "lnClass");
                                const type = templates.lnTypes.get(attr(ln, "lnType"));
                                const values = instanceValues(ln);
                                const dos = (type ? elements(type, "DO") : []).map((dobj) => ({
                                    kind: "DO" as const,
                                    name: attr(dobj, "name"),
                                    detail: templates.doTypes.get(attr(dobj, "type"))?.getAttribute("cdc") ?? "",
                                    children: objectNodes(templates, attr(dobj, "type"), values, attr(dobj, "name"), 0),
                                }));
                                const dataSets = elements(ln, "DataSet").map((set) => ({
                                    kind: "DS" as const,
                                    name: attr(set, "name"),
                                    children: elements(set, "FCDA").map((fcda) => ({
                                        kind: "DA" as const,
                                        name: `${attr(fcda, "ldInst")}/${attr(fcda, "prefix")}${attr(fcda, "lnClass")}${attr(fcda, "lnInst")}.${[attr(fcda, "doName"), attr(fcda, "daName")].filter(Boolean).join(".")}`,
                                        fc: attr(fcda, "fc"),
                                        children: [],
                                    })),
                                }));
                                const controls = ["GSEControl", "ReportControl", "SampledValueControl"].flatMap((name) =>
                                    elements(ln, name).map((block) => ({
                                        kind: "CB" as const,
                                        name: attr(block, "name"),
                                        detail: [name, attr(block, "datSet") && `datSet ${attr(block, "datSet")}`, blocks.get(`${iedName}/${ldInst}/${attr(block, "name")}`)].filter(Boolean).join(" · "),
                                        children: [],
                                    })),
                                );
                                const inputs = elements(ln, "Inputs").flatMap((group) =>
                                    elements(group, "ExtRef").map((ref) => ({
                                        kind: "IN" as const,
                                        name: `${attr(ref, "iedName")}${attr(ref, "ldInst")}/${attr(ref, "prefix")}${attr(ref, "lnClass")}${attr(ref, "lnInst")}.${[attr(ref, "doName"), attr(ref, "daName")].filter(Boolean).join(".")}`,
                                        detail: [attr(ref, "serviceType"), attr(ref, "srcCBName")].filter(Boolean).join(" · "),
                                        children: [],
                                    })),
                                );
                                return { kind: "LN", name: `${attr(ln, "prefix")}${lnClass}${attr(ln, "inst")}`, lnClass, detail: attr(ln, "desc"), children: [...dos, ...dataSets, ...controls, ...inputs] };
                            }),
                        };
                    }),
                };
            }),
        };
    });
    return { ok: true, ieds };
}

/** The nodes whose name, value or detail holds the text, with the branches that lead to them. */
export function filterTree(nodes: SclNode[], query: string): SclNode[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return nodes;
    return nodes.flatMap((node) => {
        const children = filterTree(node.children, query);
        const own = [node.name, node.detail, node.value, node.lnClass].some((text) => text?.toLowerCase().includes(needle));
        return own || children.length ? [{ ...node, children: own && !children.length ? node.children : children }] : [];
    });
}
