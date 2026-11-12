# Security

Gridlingo is a static site: no account, no server, no tracking. The one thing it reads from you is an SCL file you open
in the playground, and that file is read in your browser and never uploaded. A file that makes the page crash, hang,
show something false or run code is a security problem.

## Reporting

Please report it privately through
[GitHub's private vulnerability reporting](https://github.com/araminix/gridlingo/security/advisories/new), not in a
public issue. Include the file (or how to make it) and what happens. You will get an answer within a week.

## How the site protects you

- SCL files are parsed as XML by the browser, and only their text is shown; nothing in them runs. Files over 20 MB
  are refused.
- A Content Security Policy blocks scripts and connections from anywhere but the site.
- Dependencies are few and pinned; new releases are installed only after 7 days; GitHub Actions are pinned to commits.

## What the lessons are not

The lessons teach how protocols work. They are not a security assessment of any product, and the bytes in them are
examples made for learning.
