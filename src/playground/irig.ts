/** An IRIG-B frame (B004/B007: BCD time with the year, IEEE C37.118.1 control functions, straight binary seconds). */

export type Cell = 0 | 1 | "P";
export type Group = "marker" | "seconds" | "minutes" | "hours" | "day" | "year" | "control" | "parity" | "sbs" | "index";

export interface IrigTime {
    hours: number;
    minutes: number;
    seconds: number;
    /** Day of the year, 1 to 366. */
    day: number;
    /** The year's last two digits. */
    year: number;
}

/** Each cell's group: every tenth cell is a position marker, the rest as the frame lays them out. */
export const GROUPS: readonly Group[] = Array.from({ length: 100 }, (_, bit): Group => {
    if (bit % 10 === 9 || bit === 0) return "marker";
    if ((bit >= 1 && bit <= 4) || (bit >= 6 && bit <= 8)) return "seconds";
    if ((bit >= 10 && bit <= 13) || (bit >= 15 && bit <= 17)) return "minutes";
    if ((bit >= 20 && bit <= 23) || (bit >= 25 && bit <= 26)) return "hours";
    if ((bit >= 30 && bit <= 33) || (bit >= 35 && bit <= 38) || (bit >= 40 && bit <= 41)) return "day";
    if ((bit >= 50 && bit <= 53) || (bit >= 55 && bit <= 58)) return "year";
    if ((bit >= 60 && bit <= 68) || (bit >= 70 && bit <= 74)) return "control";
    if (bit === 75) return "parity";
    if ((bit >= 80 && bit <= 88) || (bit >= 90 && bit <= 97)) return "sbs";
    return "index";
});

/** Whether a time can be sent: a real time of day, a day of the year and a two-digit year. */
export const isTime = ({ hours, minutes, seconds, day, year }: IrigTime) =>
    [hours, minutes, seconds, day, year].every(Number.isInteger) && hours < 24 && minutes < 60 && seconds < 60 && day >= 1 && day <= 366 && year >= 0 && year <= 99 && hours >= 0 && minutes >= 0 && seconds >= 0;

/**
 * The 100 cells of the frame for a UTC time with time quality 0 (locked): the BCD digits low bit first, no time offset,
 * no leap second or daylight saving pending, even parity over bits 1 to 74, then the seconds of the day in binary.
 */
export function irigFrame(time: IrigTime): Cell[] {
    const cells: Cell[] = Array.from({ length: 100 }, (_, bit) => (GROUPS[bit] === "marker" ? "P" : 0));
    const put = (value: number, first: number, width: number) => {
        for (let i = 0; i < width; i++) cells[first + i] = ((value >> i) & 1) as 0 | 1;
    };
    const bcd = (value: number, units: number, tens: number, tensWidth: number) => {
        put(value % 10, units, 4);
        put(Math.floor(value / 10) % 10, tens, tensWidth);
    };
    bcd(time.seconds, 1, 6, 3);
    bcd(time.minutes, 10, 15, 3);
    bcd(time.hours, 20, 25, 2);
    bcd(time.day % 100, 30, 35, 4);
    put(Math.floor(time.day / 100), 40, 2);
    bcd(time.year, 50, 55, 4);
    const ones = cells.slice(1, 75).filter((cell) => cell === 1).length;
    cells[75] = (ones % 2) as 0 | 1;
    const sbs = time.hours * 3600 + time.minutes * 60 + time.seconds;
    put(sbs & 0x1ff, 80, 9);
    put(sbs >> 9, 90, 8);
    return cells;
}

/** How long a cell's pulse lasts, in ms of its 10 ms. */
export const pulseOf = (cell: Cell) => (cell === "P" ? 8 : cell === 1 ? 5 : 2);
