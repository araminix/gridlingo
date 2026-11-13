// Which protocols the comparison page (/compare) can set side by side, kept apart from the page so the lessons and the
// home page can link to it without loading it.

/** The protocols the page offers, in its order: each has a frame that tells the same trip. */
export const COMPARED: readonly string[] = ["iec-61850-goose", "iec-104", "iec-101", "iec-103", "dnp3", "modbus-tcp"];
/** More than four columns no longer fit side by side on a wide screen. */
export const MAX_COMPARED = 4;
/** Shown when the address picks none: the fastest, two control-room protocols and one that has to ask. */
const FIRST: readonly string[] = ["iec-61850-goose", "iec-104", "dnp3", "modbus-tcp"];

/** The protocols an address's ?p= picks: the known ones, in the page's order, at most four; else the first four. */
export function pickedFrom(search: string): readonly string[] {
    const asked = new URLSearchParams(search).get("p")?.split(",") ?? [];
    const known = COMPARED.filter((id) => asked.includes(id)).slice(0, MAX_COMPARED);
    return known.length ? known : FIRST;
}

/** The page's address from a lesson: that lesson's protocol is among the ones shown. */
export function compareFrom(id: string) {
    if (FIRST.includes(id)) return "/compare";
    const others = FIRST.slice(0, MAX_COMPARED - 1);
    return `/compare?p=${COMPARED.filter((item) => item === id || others.includes(item)).join(",")}`;
}
