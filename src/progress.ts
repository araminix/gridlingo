import { useSyncExternalStore } from "react";
import { readStored, writeStored } from "./settings";

const KEY = "gridlingo.done";
const listeners = new Set<() => void>();
let done: readonly string[] = (() => {
    const stored = readStored(KEY);
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === "string") : [];
})();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** Marks a lesson as played to its last step, in this browser. */
export function finish(id: string) {
    if (done.includes(id)) return;
    done = [...done, id];
    writeStored(KEY, done);
    for (const listener of listeners) listener();
}

/** The lessons this browser has played to their last step. */
export const useDone = () => useSyncExternalStore(subscribe, () => done, () => done);
