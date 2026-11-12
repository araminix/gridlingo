# Contributing

Thank you for helping. Gridlingo is meant to stay small and exact: lessons a person can trust, in plain words, and the
simplest code that shows them.

## Set up

You need Node.js 22 or later and pnpm 11.

```bash
pnpm install
pnpm dev    # http://localhost:5173
```

## What you can help with

- **A correction.** A byte, a port, a rule or a word that is wrong: open an issue or a pull request, and say where it
  comes from (the standard's clause, a capture, a device's manual).
- **A lesson.** Read [docs/lessons.md](docs/lessons.md) first: what a good lesson has, how to write its words, how to
  prove its bytes.
- **A translation.** Each language has a file for the interface (`src/i18n/locales/<lang>.json`), one per lesson
  (`src/lessons/<id>/<lang>.json`) and one for the glossary (`src/glossary/<lang>.json`), each with exactly the keys
  of the English one. Keep numbers, hex and technical names as
  they are; the tests check it.

## Before a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e    # end to end and visual, on a desktop and a phone
```

CI runs all of them on every pull request. A visual change updates the screenshots it changes
(`pnpm e2e --update-snapshots`) and the pull request says why they changed.

## Rules

- No text, tables or figures copied from a standard: IEC, IEEE and the DNP Users Group own theirs.
- Sample files are made up. Never a real site's, customer's or vendor's file.
- New dependencies only when there is no small way without them; pnpm installs releases at least 7 days old.
