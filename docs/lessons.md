# Writing a lesson

A lesson shows one protocol doing one real job, step by step: who sends what to whom, the bytes on the wire, and what
each device knows afterwards. The three worked examples are `src/lessons/iec-104`, `src/lessons/iec-61850-goose` and
`src/lessons/iec-61850-mms`. Read one before you start, and copy its shape.

## The files

```
src/lessons/<id>/
  lesson.ts        the data: devices, steps, frames and their bytes (no words to translate)
  en.json          every word a person reads, in English (the source of every translation)
  <lang>.json      the same texts in another language, same keys
  lesson.test.ts   checks that the bytes are ones a real device would accept
  <sample>         an optional sample file for the playground (made up, never a real customer's)
```

`<id>` is the protocol's id in `src/lessons/catalog.ts`. The shape of every part is in `src/lessons/types.ts`, with a
comment on each field. `src/lessons/lessons.test.ts` checks every lesson: all keys the data names exist in `en.json`,
nothing in `en.json` is unused, every step has a frame, and every translation has exactly the English keys.

## What a good lesson has

- **One scenario from a real site**, told in 4 to 7 steps: connect, ask, answer, something changes, it is
  acknowledged. Pick the job the protocol is really used for (an RTU reporting a breaker trip, a charger starting a
  session, a meter read at midnight).
- **6 to 14 frames.** Each belongs to a step; steps appear in order. Give the bytes (`fields`) of the frames that
  teach something; a frame told only in words (a TCP handshake, a long handshake) has `notes.<frame id>` instead.
- **Real bytes.** Every byte must be what a real device would send: lengths that count, CRCs and checksums that
  match, BER lengths that add up, values that decode to what the text says. Work them out with a script, and prove
  them in `lesson.test.ts` with the helpers in `src/lessons/bytes.ts` (`bytesOf`, `crc16Modbus`, `crc16Dnp`,
  `checksum8`, `berProblems`). Use made-up but valid addresses: private IPs (10.x), locally administered MACs
  (`02-…`), example vendors.
- **Fields cut where the meaning changes**: a start byte, a length, a type, an address, a value. A tag, its length
  and its value can be one field. Pick the role (the colour) by what it carries: `frame`, `control`, `type`, `size`,
  `cause`, `address`, `value`, `quality`, `time`, `security`.
- **The site** (`scene`): the devices on an isometric grid. `at: [x, y]` is in grid steps; x runs to the lower right
  on the screen, y to the lower left. Keep devices 2 to 4 steps apart, put the ones that talk most in the middle, and
  mark them `active`. A cable runs along x first, or along y with `via: "y"`; choose so that cables and labels do
  not cross names. Frames travel the shortest way through the links (through a switch or a broker); `link` forces
  one. Label only the main link (`IEC 104 · TCP 2404`); labels are technical and never translated.
- **The sequence view** (`actors`): every device that sends or receives a frame, left to right.
- **What the devices know** (`points`, optional): a few signals, with the value in the sender and in the receiver,
  step by step. This is where the reader sees the data arrive.
- **Extras, only when they teach something:**
  - `singleLine`: a substation single-line diagram, for protection and substation protocols.
  - `timing`: when time is the point (repeats, sample rates, time codes, signal levels).
  - `anatomy`: a name or address taken apart (an object reference, an OBIS code, an MQTT topic).
  - `playground`: `encoder` (a number and its bytes in each byte order), `scl` (an IEC 61850 SCL file as a tree),
    or `file` (a sample file with notes on its lines: a register map, a JSON message, a configuration).
- **Facts** (`facts`): the standard, between whom, the transport, the security, and one more if it matters.
- **3 or 4 tips** from the field: the mistakes people really make.
- **2 to 4 related lessons.**

## How to write the words

People read this to learn, often in their second language, and it is translated into 13 more. So:

- Short sentences. Plain words. One idea per sentence.
- Say what happens and why it matters, nothing else. No "In this lesson we will…", no "Let's dive in", no praise of
  the protocol, no filler.
- Write for someone who knows what a network is, but not this protocol. Explain a term the first time, in a few words.
- A frame's text (`frames.<id>`) is what it says, as a person would: "Please start sending data", "CB-1 is closed".
- A field's note says what the bytes mean here, with their value decoded: "0x0D = 13: a measured value as a float".
- Write numbers, hex, names of types and services exactly as on the wire (`C_IC_NA_1`, `0x88B8`, `MMXU1`). Translators
  keep them as they are; the tests check that hex survives.
- Never copy text, tables or figures from a standard. IEC, IEEE and the DNP Users Group own theirs. Explain in your
  own words; cite the standard's number in `facts.standard`.
- Be exact. If you are not sure that a byte, a port or a rule is right, find out or leave it out.

## Check your lesson

```bash
pnpm exec vitest run src/lessons/<id>                                   # your byte tests
pnpm exec vitest run src/lessons/lessons.test.ts -t "the <id> lesson"   # the checks every lesson passes
pnpm typecheck
pnpm dev                                                                # then open /p/<id> and play every step
```

Every lesson is translated into all the interface's languages before it is merged; until then its translation
checks fail. A pull request may bring the English texts only: the maintainers add the translations.

Look at every step in the site and the sequence view, in the light and the dark theme, on a wide screen and a phone:
no label may cover another, and every frame must travel where the text says.
