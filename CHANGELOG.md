# Changelog

All notable changes to `dsh-route-resilience` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-08-19

### Public release / rebranding

- Renamed the project from `dsh-key-rotation` to **`dsh-route-resilience`** and
  repositioned it as a multi-route high-availability, fault-isolation and
  observability layer for DeepSeek Harness (reliability, not quota bypass).
- Renamed all identifiers for brand consistency: `KeyRotationRouter` →
  `RouteResilienceRouter`, settings namespace, status route
  (`/api/dsh-route-resilience/status`), client component, locale namespace,
  and cordis patch id. Session event types (`llm/failover`, `llm/key-status`)
  are kept unchanged as they are generic semantic terms.
- Converted into a **self-contained OSS project**:
  - standalone `package.json` with `@deepseek-ai/*` declared as
    `peerDependencies` (runtime contracts) plus `devDependencies` (for building
    against the published npm packages — no DSH monorepo required)
  - standalone `tsconfig.json` / `tsconfig.client.json` (no monorepo base or
    project references)
  - new `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE` (MIT)
  - GitHub Actions CI (build + test + `npm audit`)
- Added explicit compliance statement: does not bypass quotas, does not support
  multi-account circumvention, only uses credentials and routes the user is
  authorized to use.

## [0.1.x] - 2026-08-16 (private, pre-open-source)

Development history of the plugin before it was published, kept for reference.

### Added

- Core router: model groups over ordered provider routes, round-robin
  allocation, per-step route pinning, turn-boundary cleanup.
- Fault handling: 429 / `RATE_LIMIT` quarantine with exponential backoff
  (honoring downstream `Retry-After` when provided), 401/402/403 and
  auth/quota errors disable a route permanently, lazy revival on quarantine
  expiry, force-revival when every route is down.
- Credential isolation: the router only references provider route names;
  key material is owned by the provider adapter (`llm-pi-ai`) via per-route
  credential references.
- DSH integration: `agent/request`, `agent/request-error`,
  `agent/turn-stopping` event handlers; self-healing settings namespace
  registration; read-only status route; `llm/failover` and `llm/key-status`
  session events.
- Web settings panel (`settings.models.item` slot): live health badges,
  group/key editor with rollback-safe saves that create provider routes and
  bind credential references.

### Fixed

- Desktop runtime dependency resolution: the packaged desktop host (pure Node)
  could not resolve the plugin's `@deepseek-ai/*` runtime dependencies without
  the monorepo's tsx path mapping. Bundling the plugin into the workspace so it
  got its own `node_modules` links fixed `Cannot find package
  '@deepseek-ai/schemastery'` on desktop startup.

[0.2.0]: https://github.com/lokic7123-star/dsh-route-resilience/releases/tag/v0.2.0
