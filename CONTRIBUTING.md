# Contributing to dsh-route-resilience

Thanks for wanting to help. This project is small on purpose, so please read this
before opening an issue or a pull request.

## Scope and posture

`dsh-route-resilience` is a **reliability** plugin for DeepSeek Harness. It makes
no claims about, and provides no support for, bypassing quotas, rate limits, or
provider terms. Contributions that add quota circumvention, multi-account
aggregation, or misuse of credentials will be rejected.

## Getting started

Requirements: Node `>= 20`, a package manager (npm is used in CI), and the
`@deepseek-ai/*` packages from the npm registry (installed automatically).

```bash
npm install
npm run build   # host tsc build + client tsdown bundle
npm test        # unit tests (node --import tsx --test tests/router.test.ts)
```

CI runs build + tests + `npm audit` on every push and pull request.

## What goes where

- `src/index.ts` — host half: `RouteResilienceRouter`, the config schema, and the
  Agent Loop / settings / web-server wiring.
- `src/client/` — browser half: the Models-page settings panel, locale dictionaries,
  and the `settings.models.item` slot injection.
- `tests/router.test.ts` — unit tests for the routing/health state machine.

## Opening a pull request

1. Keep changes focused. If a change starts to sprawl, split it.
2. Add or update tests for the routing/health behavior you touch — bug reports
   without a failing test are harder to act on.
3. Run `npm run build` and `npm test` locally and make sure they pass.
4. Write a PR description explaining the problem, the change, and any trade-offs.

Small, well-scoped PRs merge much faster than large ones.

## Reporting bugs

Open an issue with:

- DeepSeek Harness and Node versions
- your `dsh-route-resilience` version
- the plugin configuration you used (redact key values!)
- logs and the exact expected vs. actual behavior

Never paste real API keys, credential references, or private configuration into
an issue or PR. For security-sensitive issues, use [SECURITY.md](./SECURITY.md).

## Code of conduct

Be respectful. Participation is governed by our
[Code of Conduct](./CODE_OF_CONDUCT.md).
