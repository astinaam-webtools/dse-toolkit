# Cursor SDK + Live Model Picker Integration Plan

**Date:** 2026-07-26  
**Status:** Planned (not started)  
**Package:** [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk)  
**Docs:** [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript)  
**Related:** `docs/COPILOT_SDK_IMPLEMENTATION_PLAN.md` (no longer relevant; backend code retained)

This document is the full build spec for the feature. Every decision below is locked. There is no phased “product slice,” no “later,” and no open assumptions left for implementers to invent.

---

## 1. Objective

Ship **Cursor** as a selectable **server-side AI analyst provider** beside OpenRouter, plus a **shared searchable model picker** (context, pricing, description, reasoning/params) for **both** providers across Settings and Chat.

Do not remove OpenRouter. Do not delete Copilot SDK / GitHub OAuth backend code. Do not run `@cursor/sdk` in the browser.

### Locked product behavior

1. Server AI mode: provider = `openrouter` | `cursor-sdk`.
2. Client AI mode: OpenRouter in the browser only (unchanged provider); uses the **same searchable picker** hydrated from OpenRouter’s models API with the local key.
3. Chat and Settings show a searchable model combobox + selected-model detail panel (ctx, pricing, description, params/variants).
4. Cursor runs are local agents with sandbox, per-session store/cwd, server-owned session mapping, SSE token streaming to the chat UI, and full dispose on reset/logout.
5. OpenRouter server chat keeps request/response **and** gains SSE streaming parity so one chat client code path handles both providers.

---

## 2. Permanent exclusions

These are **not** part of this feature (not deferred — excluded):

- Cloud Cursor agents (`cloud: { repos }`), auto-PRs, agent kanban UIs.
- MCP servers.
- Cursor Canvas / IDE automations.
- Browser-side `@cursor/sdk`.
- Capacitor/Android packaging changes for the SDK.
- Multi-replica / horizontally scaled API servers for Cursor agent cache (deploy **one** Railway service instance for the API).
- Deleting or rewriting Copilot SDK OAuth/test routes.
- Injecting `portfolio.json` / market snapshot files into agent workspaces (prompt context stays in `messages[]` + fixed `CONTEXT.md` instructions only).

---

## 3. Locked architecture decisions

| Topic | Locked choice |
|---|---|
| Language | `@cursor/sdk` from existing Node ESM `server/` |
| Cursor runtime | Local only: always pass `local: { cwd, store, sandboxOptions, settingSources: [] }` |
| `cwd` | `CURSOR_WORKSPACE_ROOT/<userId>/<sessionId>/cwd` |
| `store` | `JsonlLocalAgentStore` at `CURSOR_WORKSPACE_ROOT/<userId>/<sessionId>/store` (per session, not shared across threads) |
| Default home/SQLite store | Forbidden |
| Sandbox | Always `sandboxOptions.enabled: true` when Cursor is enabled. If sandbox cannot start → `sandboxReady: false`, Cursor provider disabled, chat/settings show reason |
| Hooks | Deny-by-default: reject `beforeShellExecution`; reject writes outside session `cwd` |
| `settingSources` | Always `[]` |
| Auth keys | Env `CURSOR_API_KEY` **and** per-user Cursor key in `user_ai_settings` (same pattern as OpenRouter). Effective key = user key if set, else env |
| Default provider | `openrouter` |
| Node | `>=22.13.0`; Railway pin `NIXPACKS_NODE_VERSION=22.13.0` in deploy config |
| Response `message` | Always string |
| Streaming | SSE from `POST /api/ai/chat` for **both** providers; final event carries the same JSON shape as today’s success body |
| OpenRouter models | Live `GET https://openrouter.ai/api/v1/models` primary; `server/src/models.js` only if live fetch fails |
| Cursor models | `Cursor.models.list({ apiKey })` only (plus single-model soft fallback if list fails and `CURSOR_DEFAULT_MODEL` is set) |
| Models cache TTL | 10 minutes, keyed by `provider + apiKeyFingerprint` |
| Picker filter | Client-side only; max **50** visible matches; show “Type to narrow…” when truncated |
| Agent cache | In-memory `Map`, key `userId:sessionId`, max **50** entries, TTL **30 minutes** idle |
| Cursor concurrency | Max **2** in-flight Cursor runs per user; max **30** Cursor chat requests per user per hour |
| Cursor timeout | Server `CURSOR_CHAT_TIMEOUT_MS=300000`; client abort 300000 for Cursor; OpenRouter client stays 120000 |
| `sessionId` | Required for `provider: "cursor-sdk"`. Chat uses thread id. Market/stock one-shots mint `ephemeral-<uuid>` per request and reset after completion |
| Missing `sessionId` on Cursor | HTTP 400 |
| Client-supplied `agentId` | Corroboration only; must match server map or HTTP 403 |
| Deploy topology | Single Node process for API (no sticky-session design) |

---

## 4. Environment & package

| Variable | Required | Default / value |
|---|---|---|
| `CURSOR_API_KEY` | Yes to enable Cursor without per-user key | — |
| `CURSOR_DEFAULT_MODEL` | No | `composer-2.5` |
| `CURSOR_WORKSPACE_ROOT` | No | `./data/cursor-workspaces` |
| `CURSOR_SDK_LOG_LEVEL` | No | `info` |
| `CURSOR_CHAT_TIMEOUT_MS` | No | `300000` |
| `CURSOR_REQUIRE_SANDBOX` | No | `true` |
| `CURSOR_AGENT_CACHE_MAX` | No | `50` |
| `CURSOR_AGENT_CACHE_TTL_MS` | No | `1800000` |
| `CURSOR_MAX_CONCURRENT_PER_USER` | No | `2` |
| `CURSOR_MAX_REQUESTS_PER_USER_HOUR` | No | `30` |
| `NIXPACKS_NODE_VERSION` | Yes on Railway | `22.13.0` |
| `engines.node` in `server/package.json` | Yes | `>=22.13.0` |

Pin exact `@cursor/sdk` version in `server/package.json` at install time (no floating `latest`).

Update `server.railway.json` / Railway variables so Node **22.13.0** is pinned in config, not README-only.

---

## 5. API contracts

### 5.1 Success chat body (final SSE event and non-error completion)

```json
{
  "provider": "cursor-sdk",
  "model": "composer-2.5",
  "modelParams": [{ "id": "fast", "value": "true" }],
  "message": "assistant text here",
  "meta": {
    "mode": "manual",
    "agentId": "agent-…",
    "runId": "…",
    "sessionId": "thread-uuid",
    "latencyMs": 1234,
    "respondedAt": "2026-07-26T00:00:00.000Z",
    "usage": {
      "inputTokens": 10,
      "outputTokens": 5,
      "reasoningTokens": 0
    }
  }
}
```

- `message` is always a string.
- Errors never use `message` as the assistant answer. Error JSON: `{ "error": "…", "retryable": true|false, "agentId": null|"…", "runId": null|"…" }`.

### 5.2 SSE framing (`POST /api/ai/chat`)

Request header: `Accept: text/event-stream` **or** body `"stream": true` (support both; if either present → SSE).

Events:

| `event` | `data` |
|---|---|
| `meta` | `{ "provider", "model", "modelParams", "sessionId", "agentId"? }` at start |
| `delta` | `{ "text": "…" }` assistant text chunks |
| `done` | full success body from §5.1 |
| `error` | error JSON; then close |

OpenRouter path: stream upstream tokens into the same `delta` events; `done` matches today’s fields plus `modelParams` when sent.

If client does not request stream: buffer and return §5.1 JSON once (backward compatible).

### 5.3 `POST /api/ai/chat` request

```json
{
  "provider": "openrouter" | "cursor-sdk",
  "model": "composer-2.5",
  "modelParams": [{ "id": "fast", "value": "true" }],
  "mode": "manual" | "auto",
  "stream": true,
  "messages": [
    { "role": "system", "content": "…" },
    { "role": "user", "content": "…" }
  ],
  "cursor": {
    "sessionId": "thread-uuid"
  }
}
```

Rules:

- `provider` default `openrouter`.
- `cursor-sdk` requires configured key + `sandboxReady` + `cursor.sessionId`.
- `modelParams` default `[]`. Cursor maps to `model: { id, params: modelParams }`. OpenRouter: ignore unknown params; do not fail.
- On Cursor follow-up (server has mapping for `userId:sessionId`): send **only the latest user message** as the agent prompt; prior turns live in the agent checkpoint.
- On first turn or after model/params change: create new agent; dispose previous for that session.
- Always `await run.wait()` after streaming observation; distinguish `CursorAgentError` (startup) vs `result.status === "error"`.
- Honor `error.isRetryable` in logs and error payload.

### 5.4 Auto mode

- OpenRouter: `pickRandomModel` over the **live** list (fallback list if live failed).
- Cursor: if `CURSOR_DEFAULT_MODEL` exists in live list, use it; else first model in live list; apply that model’s default variant params when `variants` marks `isDefault`, else first value of each parameter.

### 5.5 Models list

`GET /api/ai/models?provider=openrouter|cursor-sdk`  
Default provider query: `openrouter`.

```json
{
  "provider": "openrouter",
  "defaultModel": "openrouter/free",
  "source": "live",
  "models": [
    {
      "model_id": "google/gemma-3-27b-it:free",
      "model_name": "Google: Gemma 3 27B (free)",
      "description": "",
      "context_length": 131072,
      "pricing": {
        "prompt_per_million": 0,
        "completion_per_million": 0,
        "currency": "USD",
        "display": "Free"
      },
      "capabilities": {
        "reasoning": false,
        "tools": false,
        "modalities": ["text"]
      },
      "parameters": [],
      "variants": []
    }
  ]
}
```

Field rules:

| Field | Rule |
|---|---|
| `description` | string; use `""` when absent |
| `context_length` | number or `null` |
| `pricing` | object or `null`. If `null`, UI shows `Billed on Cursor plan` for Cursor and `—` for OpenRouter |
| `pricing.display` | preformatted for chips (`Free`, `$0.10 / $0.40`, etc.) |
| `capabilities.reasoning` | boolean |
| `capabilities.tools` | boolean |
| `capabilities.modalities` | string array; default `["text"]` |
| `parameters` | always array |
| `variants` | always array |
| `source` | `"live"` or `"fallback"` |

**OpenRouter mapping** from `https://openrouter.ai/api/v1/models` `data[]`:

- `id` → `model_id`
- `name` \|\| `id` → `model_name`
- `description` \|\| `""` → `description`
- `context_length` → `context_length`
- `pricing.prompt` / `pricing.completion` (per-token) × 1e6 → `prompt_per_million` / `completion_per_million`
- `pricing.display`: `Free` if both rates are 0; else `$${prompt} / $${completion}` with sensible decimals
- modalities from `architecture.modality` / input-output modalities when present
- `capabilities.reasoning`: true if model id/name/description contains reasoning indicators OpenRouter exposes, or supported parameter names include reasoning; else false
- Use effective OpenRouter API key when available; public fetch allowed without key

**Cursor mapping** from `Cursor.models.list`:

- `id` → `model_id`
- `displayName` \|\| `id` → `model_name`
- `description` \|\| `""` → `description`
- `parameters` / `variants` copied fully
- `context_length`: `null`
- `pricing`: `null` (UI: `Billed on Cursor plan`)
- `capabilities.reasoning`: true if any parameter `id` matches `/reason|effort|think/i` or any variant/description matches; else false
- `capabilities.tools`: true (agents can use tools; sandbox still denies shell)

### 5.6 Settings

`GET /api/ai/settings`:

```json
{
  "provider": "cursor-sdk",
  "model": "composer-2.5",
  "modelParams": [{ "id": "fast", "value": "true" }],
  "configured": true,
  "sandboxReady": true,
  "cursorDisabledReason": null
}
```

- Never return API keys.
- `configured` for OpenRouter: env or user OpenRouter key present.
- `configured` for Cursor: (env or user Cursor key) **and** `sandboxReady` when `CURSOR_REQUIRE_SANDBOX=true`.
- `cursorDisabledReason`: string when Cursor cannot run (e.g. `Sandbox unavailable (bubblewrap)`), else `null`.

`PUT /api/ai/settings` body:

```json
{
  "provider": "openrouter" | "cursor-sdk",
  "apiKey": "optional secret",
  "model": "composer-2.5",
  "modelParams": []
}
```

- Provider `openrouter`: existing `sk-or-` validation when key sent.
- Provider `cursor-sdk`: key must be non-empty; if it does not start with `cursor_`, reject with clear 400.
- Empty `apiKey` means “keep existing user key.”
- Persist `provider`, `model`, `modelParams`, encrypted/plain key same as today’s OpenRouter storage pattern.

### 5.7 Cursor session routes

| Method | Path | Body | Behavior |
|---|---|---|---|
| `POST` | `/api/ai/cursor-sdk/session/reset` | `{ "sessionId": "…" }` | Dispose that session’s agent; delete cwd+store |
| `POST` | `/api/ai/cursor-sdk/session/reset` | `{ "all": true }` | Dispose all sessions for `request.user.id` |
| `GET` | `/api/ai/cursor-sdk/test/health` | — | Diagnostics (Node, import, sandbox, configured) |
| `GET` | `/api/ai/cursor-sdk/test/models` | — | Same normalize as production models |
| `POST` | `/api/ai/cursor-sdk/test/prompt` | `{ model, modelParams?, prompt }` | One-shot `Agent.prompt`; dispose |
| `POST` | `/api/ai/cursor-sdk/test/chat` | chat-like body with `sessionId` | Multi-turn test |
| `POST` | `/api/ai/cursor-sdk/test/session/reset` | same as production reset | Alias to production reset handler |

UI and `logout()` call **production** reset only (`/session/reset`), never `/test/`.

On logout / clear auth: client calls `{ "all": true }` before clearing the token. Server also exposes internal `disconnectUser(userId)` used if a future account-delete path is added.

---

## 6. Modules & files

```
server/src/
  config.js
  cursorSdkService.js      # NEW
  cursorWorkspace.js       # NEW
  openrouterModels.js      # NEW
  openrouterClient.js      # stream support if missing
  ai.js
  server.js
  db.js / settings helpers

src/
  lib/modelPicker.js       # NEW
  lib/serverClient.js
  lib/appSettings.js
  chatApp.js
  chat.html
  settingsApp.js
  settings.html
  marketApp.js             # server AI uses settings model+params; stream-aware client helper
  stockDetailApp.js        # same
  styles.css               # .model-picker*, .model-detail*
```

### 6.1 Workspace lifecycle

```
ensureSession(userId, sessionId)
  cwd   = ROOT/userId/sessionId/cwd
  store = ROOT/userId/sessionId/store
  write CONTEXT.md (fixed analyst system instructions; no user PII)
  return { cwd, storePath }

create agent → cache[userId:sessionId] = { agentId, cwd, storePath, model, modelParams, lastUsed }

send → authorize → resume or create with identical local options
  stream deltas → wait → return

on model or modelParams change → dispose old → create new → update cache

reset(sessionId) or reset(all) or TTL eviction or process shutdown
  → asyncDispose → rm session dirs under ROOT only (path-guarded)
```

Path rule: resolve with `path.resolve`; reject if not under realpath of `CURSOR_WORKSPACE_ROOT`.

### 6.2 `CONTEXT.md` contents (fixed)

Short analyst instructions only: DSE/Bangladesh market context, refuse shell/system probing, answer from provided messages, no financial advice disclaimer line. No portfolio or holdings data.

### 6.3 Prompt mapping

Same as Copilot adapter: join `messages` as `ROLE: content` blocks separated by blank lines for first turn / OpenRouter. Cursor follow-ups: latest user `content` only.

---

## 7. Frontend (concrete)

### 7.1 Shared `modelPicker.js`

Mounts into a container; API:

- `createModelPicker({ mount, detailMount, provider, mode, onChange })`
- `hydrate(models, { selectedId, selectedParams, source })`
- `getSelection()` → `{ modelId, modelParams, mode: 'manual'|'auto' }`
- `setDisabled(boolean)` / `setError(message)` / `setLoading(boolean)`

Combobox a11y: `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, visible label.

Keyboard: ArrowUp/Down, Enter, Escape, Home/End, type-to-filter.

Styles in `styles.css` only: `.model-picker`, `.model-picker__input`, `.model-picker__list`, `.model-picker__option`, `.model-picker__meta`, `.model-detail`, `.model-detail__params`. Touch ≥44px. Respect `prefers-reduced-motion`.

**Each option row shows:** name; chips for ctx (`formatContext(context_length)` → `128K` or `—`); pricing (`pricing.display` or Cursor/`—` rules); reasoning badge if `capabilities.reasoning`; one-line truncated description; “Presets” hint if `variants.length > 0`.

**Detail panel shows:** name, id, full description, ctx, pricing, variant chips (default marked), one control per `parameters[]` entry. Updates live on highlight/selection.

Filter matches `model_name`, `model_id`, `description` (case-insensitive). Cap 50 rows.

Auto row:

- OpenRouter label: `Auto (random per message)`
- Cursor label: `Auto (default / first available)`

### 7.2 Chat

- Replace `#chat-model-select` with picker mount + detail mount.
- Server mode: `getServerAiModels(activeProvider)` then hydrate.
- Client mode: fetch `https://openrouter.ai/api/v1/models` with local OpenRouter key (normalize with shared pure mapper in `src/lib/openrouterModelNormalize.js` duplicated logic **or** import-free copy of mapping rules — keep one shared normalize module under `src/lib/` used only for client; server keeps `openrouterModels.js`). Implement **one** normalize algorithm documented in §5.5; server and client each have a module implementing that algorithm (no bundler — duplicate file with identical exports is acceptable if ESM can’t share server code; prefer `src/lib/modelNormalize.js` browser-safe pure functions imported by server via relative path only if Node can import from `../src` — **locked:** put pure normalize in `src/lib/modelNormalize.js` and import it from `server/src/openrouterModels.js` and `server/src/cursorSdkService.js` via `../../src/lib/modelNormalize.js`).
- Persist selection in `appSettings.ai`: `serverPreferredModel`, `serverModelMode`, `serverModelParams`, `serverAiProvider` (mirror of last known server provider for UI before GET returns).
- Send `provider`, `model`, `modelParams`, `mode`, `stream: true`, `cursor.sessionId = thread.id`.
- Render SSE deltas into the pending assistant bubble; on `done`, commit meta (model, params, latency, usage, agentId, runId).
- Clear/delete thread → `POST /api/ai/cursor-sdk/session/reset` with that `sessionId` when provider is Cursor (and always safe no-op/404 ignore if OpenRouter).
- Logout → `{ all: true }` reset then clear auth.

### 7.3 Settings

- Server mode: provider radios/select OpenRouter | Cursor.
- Show `configured`, `sandboxReady`, `cursorDisabledReason`.
- Cursor API key field (password) + save via PUT.
- Preferred model: same `modelPicker` + detail panel; save model + modelParams via PUT.
- Client mode: searchable OpenRouter picker (live) replacing free-text model input; key field unchanged.

### 7.4 Market / stock server AI

- No inline model picker on those surfaces.
- Use Settings-saved `provider`, `model`, `modelParams`, `mode`.
- For Cursor: `sessionId = ephemeral-<uuid>`; after completion call session reset for that id.
- Use shared `requestServerAiChat` streaming helper; show streamed text in existing AI UI surfaces.

### 7.5 Service worker

Bump `src/swRegister.js` version tag and `sw.js` cache names after HTML/JS/CSS changes.

---

## 8. Implementation phases (build order only)

Phases are **engineering order**, not reduced scope. The feature is incomplete until all phase gates pass.

### Phase 0 — Host readiness

- [ ] Local Node ≥ 22.13
- [ ] Railway `NIXPACKS_NODE_VERSION=22.13.0` set in project/config
- [ ] `engines.node` = `>=22.13.0`
- [ ] Staging Cursor API key available
- [ ] Confirm sandbox works on staging image **or** Cursor stays disabled with `cursorDisabledReason` until image includes `bubblewrap`/SDK helpers — Cursor must not run unsandboxed

**Gate:** health design fields agreed; Node pin committed.

### Phase 1 — Cursor foundation (no public chat yet)

- [ ] Install pinned `@cursor/sdk`
- [ ] Config env vars
- [ ] `cursorWorkspace.js` + `cursorSdkService.js` (sandbox, hooks, per-session store/cwd)
- [ ] Test + production reset routes
- [ ] Health fail-closed without sandbox
- [ ] README + `.env.example`

**Gate:** health/models/prompt smoke OK; no default store; dirs cleaned after reset.

### Phase 2 — Chat API + live models + streaming

- [ ] `modelNormalize.js` + `openrouterModels.js` + Cursor `listModels`
- [ ] `GET /api/ai/models?provider=`
- [ ] Provider-aware settings GET/PUT with `modelParams`, `sandboxReady`, `cursorDisabledReason`
- [ ] `POST /api/ai/chat` OpenRouter + Cursor branches, SSE + non-SSE
- [ ] Agent cache, rate limits, timeouts, `disconnectUser`
- [ ] Unit tests: normalize, path guards, agentId auth, auto mode, param pass-through

**Gate:** curl SSE and JSON chat work for both providers; foreign agentId → 403; live models include required fields.

### Phase 3 — Frontend picker + wiring

- [ ] `styles.css` picker/detail components
- [ ] `modelPicker.js`
- [ ] Chat SSE + picker + detail + meta
- [ ] Settings provider/key/picker/detail
- [ ] Client-mode live OpenRouter picker
- [ ] Market/stock use settings model+params + ephemeral Cursor sessions
- [ ] Logout reset-all
- [ ] SW bump

**Gate:** manual QA checklist in §10 all checked.

### Phase 4 — Proof

- [ ] 20 sequential Cursor chats, 3 concurrent, no zombie processes
- [ ] Workspace/store empty after resets
- [ ] Rate limit returns 429 with clear error
- [ ] `npm test` green
- [ ] `npm run build` green

**Gate:** metrics recorded; feature shippable.

---

## 9. Security rules (enforced)

1. Never use app repo root as `cwd`.
2. Never `settingSources: 'all'`.
3. Never enable Cursor chat without sandbox when `CURSOR_REQUIRE_SANDBOX=true`.
4. All paths under `CURSOR_WORKSPACE_ROOT` only.
5. `agentId` must match server map for `userId` + `sessionId`.
6. No API keys in GET bodies or logs.
7. Dispose on reset, logout, TTL, shutdown.
8. Document in Settings that shared env `CURSOR_API_KEY` bills the key owner.
9. Single API instance only for this feature’s agent cache.

---

## 10. Validation checklist

```bash
node -v   # >= 22.13

curl -s -H "Authorization: Bearer $JWT" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/health

curl -s -H "Authorization: Bearer $JWT" \
  "http://127.0.0.1:3001/api/ai/models?provider=openrouter"

curl -s -H "Authorization: Bearer $JWT" \
  "http://127.0.0.1:3001/api/ai/models?provider=cursor-sdk"

curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/prompt \
  -d '{"model":"composer-2.5","prompt":"Reply with exactly: cursor-sdk-ok"}'

curl -s -N -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  http://127.0.0.1:3001/api/ai/chat \
  -d '{
    "provider":"cursor-sdk",
    "model":"composer-2.5",
    "stream":true,
    "messages":[{"role":"user","content":"In one sentence, what is PE ratio?"}],
    "cursor":{"sessionId":"smoke-thread-1"}
  }'

curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/session/reset \
  -d '{"sessionId":"smoke-thread-1"}'

curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/session/reset \
  -d '{"all":true}'
```

Manual UI:

- [ ] OpenRouter server: search models; see ctx/pricing/description; send streamed reply; meta shows model
- [ ] Cursor server: search models; see params/variants; change param; streamed reply; meta shows model+params
- [ ] Client OpenRouter: searchable live picker works with local key
- [ ] Settings save provider/key/model/params survives reload
- [ ] Cursor disabled copy appears when `sandboxReady` is false
- [ ] Thread delete resets Cursor session
- [ ] Logout resets all Cursor sessions
- [ ] Foreign `agentId` cannot be resumed
- [ ] Copilot test routes still respond
- [ ] Combobox keyboard + focus rings + 360px layout OK
- [ ] 20 sequential + 3 concurrent Cursor chats clean

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| SDK API churn | Pin version; adapter boundary |
| Node 20 hosts | Engines + Railway 22.13.0 pin + health |
| Unsandboxed agents | Fail closed |
| Missing bubblewrap | Disable Cursor with explicit reason |
| Cross-tenant store | Per-session store under userId/sessionId |
| AgentId theft | Server map + 403 |
| Billing surprise | Settings copy for shared env key; per-user keys supported |
| Timeout | 300s Cursor server+client |
| Large model lists | Search + 50-row cap |
| Multi-instance cache | Single instance deploy constraint |

---

## 12. Deliverables

1. This plan (checklist).
2. Server Cursor adapter, workspace, live OpenRouter+Cursor models, SSE chat, settings, reset.
3. Shared searchable model picker + detail panel on Chat and Settings; client-mode OpenRouter picker.
4. Market/stock wired to settings model+params with ephemeral Cursor sessions.
5. README, `.env.example`, Railway Node pin.
6. Tests + smoke + load proof green.

---

## 13. Definition of done

All of the following are true:

1. Phases 0–4 gates passed.
2. Both providers work in server mode with searchable rich model picker, detail/params UI, and SSE streaming.
3. Client OpenRouter mode uses the searchable live picker.
4. Cursor never runs without sandbox when required; workspaces cleaned on reset; no zombie processes after load proof.
5. OpenRouter non-Cursor behavior preserved when OpenRouter is selected.
6. Copilot backend code retained and still responding on its routes.
7. No API keys in logs or GET settings.
8. `npm test` and `npm run build` green.

---

## 14. Build order

1. Node/Railway pin + sandbox policy  
2. Workspace + sandboxed Cursor adapter + health/reset  
3. Live models normalize + settings + SSE chat both providers  
4. Model picker UI + chat/settings/client/market/stock wiring + SW  
5. Load/rate-limit/security proof  

Do not expose Cursor on `/api/ai/chat` or in the UI until Phase 1 gate passes.
