/**
 * The shape of a lesson. A lesson folder holds `lesson.ts` (this data: devices, steps, frames, bytes) and one text file
 * per language (`en.json`, `de.json` …) with everything a person reads. Data never holds words to translate: it holds
 * keys into the texts.
 */

/** Where a protocol is met. The library groups protocols by it. */
export type Group = "substation" | "control" | "plant" | "ev" | "metering" | "iot" | "security";

/** What a scene can draw, and what the library can filter by. */
export type DeviceKind =
    | "scada"
    | "rtu"
    | "gateway"
    | "relay"
    | "breaker"
    | "merging-unit"
    | "clock"
    | "switch"
    | "inverter"
    | "pv"
    | "battery"
    | "turbine"
    | "meter"
    | "charger"
    | "car"
    | "broker"
    | "cloud"
    | "pmu"
    | "building"
    | "sensor"
    | "laptop"
    | "transformer"
    | "controller"
    | "radio"
    | "firewall";

/** A protocol in the library. Its name and wire are technical and stay the same in every language. */
export interface Meta {
    /** The address of its page: /p/<id> */
    id: string;
    name: string;
    group: Group;
    /** The devices it is met on, for the library's filter. */
    devices: DeviceKind[];
    /** How it travels: "TCP 2404 · TLS 19998". */
    wire: string;
}

/** The colour of a run of bytes, after what it carries. */
export type FieldRole = "frame" | "control" | "type" | "size" | "cause" | "address" | "value" | "quality" | "time" | "security";

/** A run of bytes (or of characters, in a name) and what it is: `fields.<key>` in the texts gives its name and meaning. */
export type Field = readonly [text: string, role: FieldRole, key: string];

export interface Step {
    /** `steps.<id>.title` and `steps.<id>.text` in the texts. */
    id: string;
}

export interface Frame {
    /** `frames.<id>` in the texts: what the frame says, in plain words. */
    id: string;
    /** The step it belongs to. */
    step: string;
    from: string;
    /** One device, or several for a multicast. */
    to: string | readonly string[];
    /** A short tag: "I", "U", "Request" … */
    kind: string;
    /** Its technical name: "STARTDT act". */
    name: string;
    /** Seconds from the start, as written: "0.045". */
    time?: string;
    /** The bytes, in order. A frame without them is explained in words only (`frames.<id>` and `notes.<id>`). */
    fields?: readonly Field[];
    /**
     * Its size on the wire, when the fields show only part of it (the header of an encrypted record); 0 when the fields
     * are not bytes on the wire but digits written as hex (a time code), so that no size is shown.
     */
    size?: number;
    /** The scene link it travels on, when it is not the one between `from` and `to`. */
    link?: string;
}

export interface Device {
    /** `devices.<id>` in the texts names it. */
    id: string;
    kind: DeviceKind;
    /** Its place on the ground, in steps of the grid (x to the lower right, y to the lower left). */
    at: readonly [number, number];
    /** An address shown under its name: "10.0.0.20", "slave 1". */
    address?: string;
    /** Taking part in the lesson: drawn in the accent colour. */
    active?: boolean;
}

export interface Link {
    id: string;
    from: string;
    to: string;
    /** Technical, the same in every language: "IEC 104 · TCP 2404". */
    label?: string;
    active?: boolean;
    /** The cable runs along x first (default), or along y first. */
    via?: "x" | "y";
    /** Radio, not a cable: drawn dotted. */
    radio?: boolean;
}

export interface Scene {
    devices: readonly Device[];
    links: readonly Link[];
}

/**
 * What the sending device holds and what the receiving one knows, step by step. A value is shown as written, or, when it
 * starts with "~", translated from `values.<rest>` in the texts.
 */
export interface Points {
    device: string;
    receiver: string;
    rows: readonly {
        /** `points.<id>` in the texts. */
        id: string;
        address: string;
        /** From the step named on: [step, in the device, in the receiver]. The first entry holds from the first step. */
        values: readonly (readonly [step: string, inDevice: string, inReceiver: string])[];
    }[];
}

/** A name or an address taken apart: `anatomy.<id>` titles it, the parts are fields. */
export interface Anatomy {
    id: string;
    parts: readonly Field[];
    /** The same name in another notation, technical: "PV1INV/MMXU1$MX$TotW$mag$f". */
    also?: string;
}

/** A timeline: when messages go out (`events`), or a signal on a wire (`signal`). Names are `timing.<key>` in the texts. */
export interface Timing {
    unit: "µs" | "ms" | "s";
    /** "log": each doubling of time takes the same width, for repeats that slow down. */
    scale: "linear" | "log";
    end: number;
    ticks: readonly number[];
    tracks: readonly {
        id: string;
        events?: readonly { t: number; mark: "event" | "repeat" | "beat"; label?: string }[];
        /** A level from each time on: [t, level 0…1]. */
        signal?: readonly (readonly [number, number])[];
    }[];
}

/** A single-line diagram of a substation bay or busbar, changing step by step. */
export interface SingleLine {
    feeders: readonly { id: string; load: "pv" | "battery" | "wind" | "line" | "supply" }[];
    /** Relays and controllers, each beside its feeder, on the station bus (or the process bus for merging units). */
    ieds: readonly { id: string; feeder?: string; bus: "station" | "process" }[];
    /** Boxes on the station bus beyond the feeders: HMI, gateway. */
    extras?: readonly string[];
    states: readonly {
        step: string;
        open?: readonly string[];
        fault?: string;
        /** A message from a device to others, drawn on the bus. */
        flow?: { from: string; to: readonly string[]; label: string };
    }[];
}

/** A playground's introduction is `playground.<intro>` in the texts, or `playground.<kind>` when it names none. */
export type Playground =
    /** A number and its bytes, both ways, in every byte order. */
    | { kind: "encoder"; type: "float32" | "int16" | "uint16" | "int32" | "uint32"; order: "ABCD" | "DCBA" | "BADC" | "CDAB"; value: number; intro?: string }
    /** An IEC 61850 SCL file (a sample, or the reader's own) as a tree. */
    | { kind: "scl"; sample: string; file: string; intro?: string }
    /** A sample file with notes on its lines: `playground.<note>` in the texts. */
    | { kind: "file"; sample: string; file: string; notes: Readonly<Record<number, string>>; intro?: string }
    /** A control pilot's duty cycle and the current it offers, both ways (IEC 61851). */
    | { kind: "pwm"; duty: number; intro?: string };

export interface Lesson {
    /** The columns of the sequence view, left to right. */
    actors: readonly string[];
    scene: Scene;
    steps: readonly Step[];
    frames: readonly Frame[];
    /** The facts shown under the title: `facts.<key>` in the texts, with labels from the interface. */
    facts: readonly FactKey[];
    points?: Points;
    anatomy?: readonly Anatomy[];
    timing?: Timing;
    singleLine?: SingleLine;
    playground?: readonly Playground[];
    /** Lessons worth reading next. */
    related?: readonly string[];
}

export type FactKey = "standard" | "between" | "transport" | "security" | "frames" | "speed" | "model" | "since";

/** Everything a person reads in a lesson, in one language. */
export interface LessonText {
    /** Two or three sentences: what it is for and how it works. */
    intro: string;
    /** For someone with no technical background: what it is for, with an everyday comparison and no jargon. */
    plain: string;
    steps: Record<string, { title: string; text: string }>;
    frames: Record<string, string>;
    /** Words on a frame: required for a frame without bytes, optional above the bytes of one with them. */
    notes?: Record<string, string>;
    fields: Record<string, { name: string; note: string }>;
    devices: Record<string, string>;
    facts: Partial<Record<FactKey, string>>;
    /** What goes wrong in the field. */
    tips: string[];
    points?: Record<string, string>;
    values?: Record<string, string>;
    anatomy?: Record<string, string>;
    timing?: Record<string, string>;
    singleLine?: Record<string, string>;
    playground?: Record<string, string>;
}
