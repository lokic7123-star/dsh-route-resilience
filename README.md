# dsh-route-resilience

Multi-route high availability, fault isolation and observability for [DeepSeek Harness](https://github.com/deepseek-ai) (DSH).

**Keep your agent working when one provider route stumbles.** `dsh-route-resilience` groups the provider routes you already have into model groups, spreads requests across the healthy routes, and fails over to the next route the moment one of them degrades — quarantining lossy routes with exponential backoff and isolating permanently broken credentials — all without ever touching the material of your API keys.

> **中文文档：[README.zh.md](./README.zh.md)**

## Scope and posture

`dsh-route-resilience` is a **reliability layer**, not a quota workaround.

- It does **not** bypass quotas, rate limits, or fair-use caps.
- It does **not** support multi-account or multi-identity circumvention of provider limits.
- It only uses **credentials and routes the user is authorized to use**. Each route stays subject to its own provider's terms of service; the number of requests a model can serve is governed by the provider, not by this plugin.
- It never reads, writes, or exposes key material — it refers to provider routes by name only.

The value is continuity: when a route you legitimately use hits a 429, times out, or loses authorization, the model keeps serving from another route you already have instead of failing the whole turn.

## Features

- **Model groups** — group an ordered list of provider routes that serve the same model under one virtual provider name, with per-route quarantine tuning.
- **Round-robin allocation** — new requests spread across the healthy routes of the active group; a request is pinned to its route for the lifetime of its step so a mid-turn retry lands on the same target.
- **Retryable failover** — on an eligible error (`RATE_LIMIT`, timeout, transport, empty response, …), the step advances to the next route while the downstream retry policy keeps its normal precedence.
- **429 / Retry-After handling** — a rate-limited route is quarantined for the provider-supplied `Retry-After` when available, otherwise an exponential backoff (`base · 2ⁿ⁻¹`, capped), and revived lazily when it expires.
- **Auth / quota isolation** — 401/402/403 and auth/quota error codes disable a route permanently, so bad credentials never poison the group.
- **Fallback** — the last route of a chain is the automatic safety net; when every route is down the earliest-expiring quarantine is force-revived so the failure surfaces cleanly instead of deadlocking.
- **Observability** — a read-only status endpoint (`/api/dsh-route-resilience/status`) plus durable `llm/failover` and `llm/key-status` session events.
- **Web settings panel** — a Models-page UI to manage groups, keys and quarantine parameters with live health badges (no restart required).

## Requirements

- DeepSeek Harness `>= 0.1.0-rc.5` (published to npm), Cordis `>= 4.0.1`
- Works as a **pure plugin** — no DeepSeek Harness core source modifications are required. It hooks the standard Agent Loop extension points (`agent/request`, `agent/request-error`, `agent/turn-stopping`), the settings service, the host web server, session events, and client UI slots.

## Install

`dsh-route-resilience` is a standard DSH plugin and follows the same profile wiring as any plugin you clone or install:

### From source (recommended today)

```bash
# 1. Clone into your DSH plugins directory
git clone https://github.com/lokic7123-star/dsh-route-resilience.git \
  /path/to/deepseek-harness-desktop/plugins/dsh-route-resilience

# 2. In the profile you use (e.g. ~/.dsh/profiles/web/package.json), add
#    "dsh-route-resilience" to dsh.profile.bundles and a link: dependency:
#      "dsh-route-resilience": "link:/path/to/deepseek-harness-desktop/plugins/dsh-route-resilience"
```

Or run the DSH plugin scaffold in the repo root:

```bash
.\new-plugin.ps1 -Target dsh -Name route-resilience   # wires bundles, link, Junction and runtime closure
```

### From npm (once published)

```bash
npm install dsh-route-resilience
```

## Configuration

### Settings namespace

The plugin reads its configuration from the `dsh-route-resilience` settings namespace (hot-reloaded on save, no restart):

```jsonc
{
  "groups": [
    {
      "id": "deepseek",          // virtual provider name used as activeGroup
      "targets": [
        { "provider": "opencode-go-1", "model": "deepseek-chat" },
        { "provider": "opencode-go-2", "model": "deepseek-chat" }
      ],
      "retryableCodes": ["RATE_LIMIT", "TIMEOUT", "TRANSPORT"],
      "quarantineBaseMs": 60000,   // optional, default 60000
      "quarantineCapMs": 300000    // optional, default 300000
    }
  ],
  "activeGroup": "deepseek"       // optional; unset = pass-through
}
```

- Each `target.provider` must reference a concrete provider route configured in your provider adapter (e.g. `llm-pi-ai`), each with its own credential reference. This plugin only swaps `provider`/`model`; it never manages keys.
- `retryableCodes` defaults to `EMPTY_RESPONSE, RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT`.
- When `activeGroup` is undefined the plugin is installed but idle — routing passes through unchanged.

### Web UI

A **Route resilience** panel is injected at the bottom of the Models settings page. It shows live health (active / quarantined / disabled with recovery countdown, chain-end fallback) and lets you add or remove keys, edit groups, error codes and quarantine parameters. Adding a key creates a provider route bound to a fresh credential reference; the key value is stored to the credential service on save.

## How it works

### Routing

1. On `agent/request`, a config whose `provider` equals `activeGroup` is resolved to the group's next healthy route (round-robin from a per-group pointer). Every other request passes through untouched.
2. The chosen route is pinned per step (`WeakMap<Agent, Map<turn/step, target>>`) so an in-flight retry stays on the same provider.
3. On `agent/request-error`, the plugin first lets the downstream retry policy decide; if it declines, an eligible error advances the step to the next route (`llm/failover` event) and returns a retry.

### Health state machine

| Route state | Entered by | Revives |
| --- | --- | --- |
| `active` | healthy / revival | — |
| `quarantined` | `RATE_LIMIT` / HTTP 429 | lazily when the backoff (or `Retry-After`) expires |
| `disabled` | `AUTH` / `INVALID_CREDENTIAL` / `QUOTA` / HTTP 401·402·403 | never (route only returns via reconfiguration or a group sweep) |

`pickStart` skips unhealthy routes; if none is healthy it force-revives the earliest-expiring quarantine to keep the model up, and if every route is disabled the first target runs so its real error surfaces rather than an infinite loop.

### Security boundary

- The host never reads or writes key material; health and status expose **route names and states only**.
- The status route is read-only, same-origin with the served web UI, and fenced from remote browsers by the host trust fence.
- Key values cross the plugin boundary in exactly one place: the settings panel's "new key" field, which writes to the credential service.

### Observability

- `GET /api/dsh-route-resilience/status` → `{ ok, data: { activeGroup, groups, health[], rotation, settingsRegistered } }`
- Session events: `llm/failover` (step switched routes) and `llm/key-status` (route quarantine / disable / revival), appended via the standard session API.

## Development

Requires Node `>= 20` and a package manager (npm is used in CI).

```bash
npm install        # installs build tooling + the @deepseek-ai/* packages needed to compile
npm run build      # typescript host build (lib/index.js) + tsdown client bundle (lib/client.js)
npm test           # unit tests for the router (node --import tsx --test tests/router.test.ts)
```

- CI runs build + tests + `npm audit` on every push and pull request (see `.github/workflows/`).
- The project is self-contained: it compiles and tests against the `@deepseek-ai/*` packages from the npm registry, so you don't need the whole DSH monorepo to develop it.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Report it privately — see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE)
