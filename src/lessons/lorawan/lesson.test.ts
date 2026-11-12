import { createCipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bytesOf } from "../bytes";
import { lesson } from "./lesson";
import codec from "./decoder.js.txt?raw";

/** The made-up AppKey every MIC and encrypted byte in the lesson was computed with. */
const APP_KEY = Buffer.from("2B7E151628AED2A6ABF7158809CF4F3C", "hex");

const aes = (key: Uint8Array, block: number[]) => {
    const cipher = createCipheriv("aes-128-ecb", key, null).setAutoPadding(false);
    return Array.from(Buffer.concat([cipher.update(Uint8Array.from(block)), cipher.final()]));
};

/** AES-CMAC (RFC 4493), the MIC of LoRaWAN is its first 4 bytes. */
function cmac(key: Uint8Array, message: number[]) {
    const double = (block: number[]) => {
        const out = block.map((byte, i) => ((byte << 1) | ((block[i + 1] ?? 0) >> 7)) & 0xff);
        if (block[0]! & 0x80) out[15]! ^= 0x87;
        return out;
    };
    const k1 = double(aes(key, Array(16).fill(0)));
    const k2 = double(k1);
    const blocks = Math.max(1, Math.ceil(message.length / 16));
    const complete = message.length > 0 && message.length % 16 === 0;
    let last = message.slice((blocks - 1) * 16);
    last = complete ? last.map((byte, i) => byte ^ k1[i]!) : [...last, 0x80, ...Array(15 - last.length).fill(0)].map((byte, i) => byte ^ k2[i]!);
    let state: number[] = Array(16).fill(0);
    for (let i = 0; i < blocks - 1; i++) state = aes(key, message.slice(i * 16, i * 16 + 16).map((byte, j) => byte ^ state[j]!));
    return aes(key, last.map((byte, j) => byte ^ state[j]!));
}

const le = (bytes: number[]) => bytes.reduceRight((value, byte) => value * 256n + BigInt(byte), 0n);
const bytesOfFrame = (id: string) => bytesOf(lesson.frames.find((frame) => frame.id === id)!.fields!);

/** Time on air of a LoRa frame at 125 kHz, coding rate 4/5, 8 preamble symbols, explicit header; SF11 and SF12 optimise for low data rates. */
function airtime(length: number, sf: number, crc: boolean) {
    const symbol = 2 ** sf / 125000;
    const low = sf >= 11 ? 1 : 0;
    const payload = 8 + Math.max(Math.ceil((8 * length - 4 * sf + 28 + (crc ? 16 : 0)) / (4 * (sf - 2 * low))) * 5, 0);
    return (8 + 4.25 + payload) * symbol;
}

describe("LoRaWAN frames", () => {
    const request = bytesOfFrame("join-request");
    const accept = bytesOfFrame("join-accept");
    const plain = aes(APP_KEY, accept.slice(1)); // the network encrypts with AES decrypt, so the sensor decrypts with AES encrypt
    const [joinNonce, netId, devNonce] = [plain.slice(0, 3), plain.slice(3, 6), request.slice(17, 19)];
    const sessionKey = (prefix: number) => Uint8Array.from(aes(APP_KEY, [prefix, ...joinNonce, ...netId, ...devNonce, 0, 0, 0, 0, 0, 0, 0]));
    const [nwkSKey, appSKey] = [sessionKey(0x01), sessionKey(0x02)];

    /** Decrypts a data frame's FRMPayload and checks its MIC; returns the header and the plain payload. */
    function data(id: string, direction: 0 | 1) {
        const bytes = bytesOfFrame(id);
        const message = bytes.slice(0, -4);
        const [address, fcnt] = [bytes.slice(1, 5), bytes.slice(6, 8)];
        const counter = [...fcnt, 0, 0];
        const b0 = [0x49, 0, 0, 0, 0, direction, ...address, ...counter, 0, message.length];
        expect(bytes.slice(-4), `${id}: MIC`).toEqual(cmac(nwkSKey, [...b0, ...message]).slice(0, 4));
        const payload = message.slice(9);
        const stream = aes(appSKey, [0x01, 0, 0, 0, 0, direction, ...address, ...counter, 0, 1]);
        return { mhdr: bytes[0], address: Number(le(address)), fctrl: bytes[5], fcnt: Number(le(fcnt)), fport: bytes[8], payload: payload.map((byte, i) => byte ^ stream[i]!) };
    }

    it("check AES-CMAC against RFC 4493", () => {
        expect(cmac(APP_KEY, [])).toEqual([...Buffer.from("BB1D6929E95937287FA37D129B756746", "hex")]);
    });

    it("send a JoinRequest with little-endian EUIs, a DevNonce and the MIC of the AppKey", () => {
        expect(request).toHaveLength(23);
        expect(request[0], "MHDR: JoinRequest, LoRaWAN R1").toBe(0x00);
        expect(le(request.slice(1, 9)), "JoinEUI").toBe(0x0200000000000001n);
        expect(le(request.slice(9, 17)), "DevEUI").toBe(0x021a4400000007b3n);
        expect(Number(le(devNonce)), "DevNonce").toBe(7);
        expect(request.slice(19)).toEqual(cmac(APP_KEY, request.slice(0, 19)).slice(0, 4));
    });

    it("answer with a JoinAccept that decrypts to the address and settings the lesson tells", () => {
        expect(accept).toHaveLength(17);
        expect(accept[0], "MHDR: JoinAccept").toBe(0x20);
        expect(Number(le(joinNonce)), "JoinNonce").toBe(12);
        expect(Number(le(netId)), "NetID").toBe(0);
        expect(Number(le(plain.slice(6, 10))), "DevAddr").toBe(0x01c2a3b4);
        expect(plain[10], "DLSettings").toBe(0x00);
        expect(plain[11], "RxDelay").toBe(1);
        expect(plain.slice(12)).toEqual(cmac(APP_KEY, [0x20, ...plain.slice(0, 12)]).slice(0, 4));
    });

    it("send an uplink that the session keys from this join check and decrypt", () => {
        const up = data("uplink", 0);
        expect(up).toMatchObject({ mhdr: 0x40, address: 0x01c2a3b4, fctrl: 0x80, fcnt: 0, fport: 1 });
        expect(up.payload).toEqual([0x01, 0xcf, 0x0e, 0x10]);
    });

    it("send a downlink in RX1 that the sensor decrypts to the new interval", () => {
        const down = data("downlink", 1);
        expect(down).toMatchObject({ mhdr: 0x60, address: 0x01c2a3b4, fctrl: 0x80, fcnt: 0, fport: 2 });
        expect(down.payload).toEqual([0x01, 0x02, 0x58]);
    });

    it("decode and encode the payloads with the sample codec", () => {
        const run = new Function(`${codec}; return { decodeUplink, encodeDownlink };`) as () => {
            decodeUplink: (input: { fPort: number; bytes: number[] }) => { data: Record<string, number> };
            encodeDownlink: (input: { data: { interval_s: number } }) => { fPort: number; bytes: number[] };
        };
        const { decodeUplink, encodeDownlink } = run();
        expect(decodeUplink({ fPort: 1, bytes: data("uplink", 0).payload }).data).toEqual({ temperature_c: 46.3, battery_v: 3.6 });
        expect(decodeUplink({ fPort: 1, bytes: [0xff, 0x9c, 0x0e, 0x10] }).data.temperature_c, "below zero").toBe(-10);
        expect(encodeDownlink({ data: { interval_s: 600 } })).toEqual({ fPort: 2, bytes: data("downlink", 1).payload });
    });

    it("open the receive windows 5 s (join) and 1 s (data) after the end of the uplink, and wait out the 1 % duty cycle", () => {
        const at = (id: string) => Number(lesson.frames.find((frame) => frame.id === id)!.time);
        const up = airtime(bytesOfFrame("uplink").length, 7, true);
        expect(up * 1000).toBeCloseTo(51.456, 3);
        expect(at("join-accept")).toBeCloseTo(at("join-request") + airtime(request.length, 7, true) + 5, 3);
        expect(at("downlink")).toBeCloseTo(at("uplink") + up + 1, 3);
        const [sends, listens] = lesson.timing!.tracks;
        expect(listens!.events![0]!.t, "RX1").toBeCloseTo(up + 1, 3);
        expect(listens!.events![1]!.t, "RX2").toBeCloseTo(up + 2, 3);
        expect(sends!.events![1]!.t, "1 % duty cycle: 99 times the time on air off").toBeCloseTo(up * 100, 3);
        expect(airtime(17, 12, true), "the tip: 1.3 s at SF12").toBeCloseTo(1.319, 3);
        expect(airtime(17, 12, true) * 99, "then over 2 minutes off").toBeGreaterThan(120);
    });
});
