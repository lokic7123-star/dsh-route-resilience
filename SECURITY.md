# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities. Report them
privately so we can fix them before they are disclosed.

- **Preferred:** GitHub private vulnerability reporting on this repository
  (Security → Report a vulnerability).
- **Fallback:** open an issue with the `security` label and mark it private, or
  contact the maintainer directly.

Please include:

- the affected version(s)
- a minimal reproduction (redact all key material and credentials)
- the impact and any suggested fix, if you have one

We aim to acknowledge reports within 5 business days and to ship a fix in a
timely patch. Please give us a reasonable window before public disclosure.

## Scope

- `src/` (host and client), build configuration, and the npm package contents.
- Credential handling: this plugin's security boundary is that it never reads,
  writes, or exposes key material. Reports that demonstrate a violation of that
  boundary are treated as highest severity.
- The plugin runs inside the DeepSeek Harness host; vulnerabilities in DSH core
  itself should be reported to the DeepSeek Harness maintainers.

## What is not a vulnerability

- Provider-side rate limiting or quota enforcement (this is expected behavior —
  see the project's [readme](./README.md) for our scope and posture).
- Issues caused by misusing or exposing your own credentials or configuration.
