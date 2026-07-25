# Cursor SDK Integration Plan (Server → optional AI provider)

**Date:** 2026-07-26  
**Status:** Planned (not started)  
**Package:** [`@cursor/sdk`](https://www.npmjs.com/package/@cursor/sdk) (TypeScript SDK, Node-first)  
**Docs:** [cursor.com/docs/sdk/typescript](https://cursor.com/docs/sdk/typescript)  
**Related:** `docs/COPILOT_SDK_IMPLEMENTATION_PLAN.md` (status: no longer relevant; backend code retained)

---

## 1. Objective

Add **Cursor** as an optional **server-side AI analyst provider** for DSE Toolkit, alongside the existing OpenRouter path, using the Cursor Agent SDK (`Agent` → `Run`).

Replace neither OpenRouter nor the retained Copilot SDK code. Cursor becomes a selectable provider when the app is in **server AI mode**.

### What this is

- Programmatic Cursor agents (`Agent.create` / `agent.send` / `Agent.prompt`).
- Inference still uses Cursor-hosted models; “local” means the agent loop + filesystem run on our Node process, not that the model is local.
- Auth via `CURSOR_API_KEY` (user key or team service-account key).

### What this is not

- Not a drop-in OpenRouter-style `/chat/completions` client.
- Not cloud agents against arbitrary GitHub repos (out of scope for v1).
- Not frontend-only; keys and agent execution stay on the server.
- Not a reason to delete Copilot SDK / GitHub OAuth backend code.

---

## 2. Fit with the current product

| Surface today | Behavior | Cursor impact |
|---|---|---|
| Settings AI mode | `client` (browser → OpenRouter) or `server` (browser → `/api/ai/chat`) | Server mode gains provider `cursor-sdk` |
| `POST /api/ai/chat` | OpenRouter only (`provider !== 'openrouter'` → 400) | Accept `provider: 'cursor-sdk'` and route to adapter |
| `GET /api/ai/models` | Static OpenRouter list from `server/src/models.js` | For Cursor, call `Cursor.models.list({ apiKey })` (or cached) |
| Chat / market / stock analyst | Message array → one assistant reply + meta | Map messages → agent prompt; return assistant text + meta (`agentId`, `runId`, latency, usage) |
| Copilot SDK routes | Backend test APIs only | Leave untouched |

**Product promise for v1:** authenticated users in server mode can choose Cursor, pick a model Cursor exposes for their key, send analyst prompts, and get a normal chat-shaped response the existing UI can render.

---

## 3. Architecture decisions (locked for this plan)

| Decision | Choice | Why |
|---|---|---|
| Language | Use `@cursor/sdk` from the existing **Node ESM** server (`server/`). No Python. | Server is already Node; matches Copilot adapter pattern. |
| Runtime (v1) | **Local only** — always pass `local: { cwd, … }` explicitly. | Cloud needs a git repo + clone; portfolio/market context is not a PR workflow. |
| Workspace | Per-request (or per-thread) **ephemeral context directory** under `server/data/cursor-workspaces/`, not the app repo root. | Avoids agents editing production source; injects market/portfolio JSON as files. |
| Tool safety | Enable `local.sandboxOptions.enabled: true` where supported; add hooks to deny shell/write outside the workspace (deny-by-default for `beforeShellExecution` / write paths). | Default headless local agents auto-approve tools — unsafe on a multi-tenant API host. |
| Invocation | Durable `Agent.create` + `agent.send` for chat threads; `Agent.prompt` only for smoke/health one-shots. | Chat needs follow-ups; must `wait()` and dispose. |
| Auth (phase A) | Server env `CURSOR_API_KEY` (and optional `CURSOR_DEFAULT_MODEL`). | Mirrors OpenRouter env fallback; simplest Railway deploy. |
| Auth (phase B) | Optional per-user Cursor API key in `user_ai_settings` when `provider = 'cursor-sdk'`. | Lets users bill their own Cursor plan; same pattern as OpenRouter user keys. |
| Streaming (v1) | **Non-streaming** HTTP: run to completion, return final text. | Current `/api/ai/chat` and chat UI are request/response. SSE can be phase 2. |
| Node version | **Node.js ≥ 22.13** for the server process. | Hard requirement of `@cursor/sdk`. Document + bump Railway/Nixpacks Node. |
| Default provider | Keep OpenRouter as default. Cursor opt-in. | No surprise billing or breakage. |
| Setting sources | `local.settingSources: []` (inline only). | Avoid loading IDE/user Cursor settings on the server. |

---

## 4. Scope

### In scope

1. Dependency + config + Node 22.13+ requirement.
2. `cursorSdkService.js` adapter (create/send/wait/dispose, model list, health).
3. Ephemeral workspace builder (write context files from request or server-side portfolio/market snapshot).
4. Test APIs under `/api/ai/cursor-sdk/…` (backend-only validation first).
5. Wire `provider: 'cursor-sdk'` into `POST /api/ai/chat` and `GET /api/ai/models` (or a Cursor-specific models route).
6. Persist optional `cursorAgentId` on chat thread meta for resume/follow-up.
7. Settings UI: provider picker when server mode is on; Cursor key/model fields (phase B).
8. Docs: `server/README.md`, `.env.example`, this plan’s checkboxes.
9. Tests + smoke curls.

### Out of scope (explicit)

- Cloud agents (`cloud: { repos }`), auto-PRs, kanban-style agent UIs.
- Replacing OpenRouter client mode.
- Removing Copilot SDK / GitHub OAuth code.
- Browser-side `@cursor/sdk` (Node-only package with native binaries).
- MCP servers in v1 (can revisit later for market-data tools).
- Cursor Canvas / IDE automations unrelated to the stock analyst.
- Changing Capacitor/Android packaging for the SDK (server-only).

---

## 5. Target API contracts

### 5.1 Config (env)

| Variable | Required | Notes |
|---|---|---|
| `CURSOR_API_KEY` | For Cursor provider | User or service-account key (`cursor_…`) |
| `CURSOR_DEFAULT_MODEL` | No | Default e.g. `composer-2.5`; always prefer `Cursor.models.list()` for picker |
| `CURSOR_WORKSPACE_ROOT` | No | Default `./data/cursor-workspaces` |
| `CURSOR_SDK_LOG_LEVEL` | No | Optional adapter logging |
| `NODE_VERSION` / engine | Yes for deploy | Document `>=22.13.0` in `server/package.json` `engines` |

### 5.2 Backend test routes (phase 1 — mirror Copilot test surface)

All require `Authorization: Bearer <jwt>` unless noted.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/ai/cursor-sdk/test/health` | Env configured? SDK importable? Node version OK? |
| `GET` | `/api/ai/cursor-sdk/test/models` | `Cursor.models.list({ apiKey })` |
| `POST` | `/api/ai/cursor-sdk/test/prompt` | One-shot `Agent.prompt` against ephemeral cwd |
| `POST` | `/api/ai/cursor-sdk/test/chat` | Multi-turn style: create/send/wait; optional `agentId` resume |
| `POST` | `/api/ai/cursor-sdk/test/session/reset` | Dispose cached agent for `sessionId` / `agentId` |

**Example `test/prompt` body:**

```json
{
  "model": "composer-2.5",
  "prompt": "Reply with exactly: cursor-sdk-ok"
}
```

**Example success shape:**

```json
{
  "provider": "cursor-sdk",
  "model": "composer-2.5",
  "status": "finished",
  "message": { "role": "assistant", "content": "cursor-sdk-ok" },
  "meta": {
    "agentId": "agent-…",
    "runId": "…",
    "latencyMs": 1234,
    "usage": { "inputTokens": 10, "outputTokens": 5 }
  }
}
```

### 5.3 Production chat route (phase 2)

Extend existing `POST /api/ai/chat`:

```json
{
  "provider": "cursor-sdk",
  "model": "composer-2.5",
  "mode": "manual",
  "messages": [
    { "role": "system", "content": "…" },
    { "role": "user", "content": "…" }
  ],
  "cursor": {
    "agentId": null,
    "sessionId": "thread-uuid",
    "context": {
      "symbol": "GP",
      "includePortfolio": false
    }
  }
}
```

Rules:

- `provider: 'openrouter'` — unchanged.
- `provider: 'cursor-sdk'` — adapter path; reject if no API key.
- Convert `messages[]` to a single user prompt string (roles labeled), or send only the latest user turn when `agentId` is present (follow-up).
- Always `await run.wait()`; map `result.status === 'error'` to HTTP 502 with `runId`; map thrown `CursorAgentError` to 502/503 with `retryable` flag.
- Always dispose agents that are not being retained for the thread; for retained agents, keep a bounded in-memory cache keyed by `userId:sessionId` with TTL + max size, and dispose on reset/logout.

### 5.4 Models

- Prefer `GET /api/ai/models?provider=cursor-sdk` or separate `GET /api/ai/cursor-sdk/models`.
- Cache list in-process for ~5–15 minutes per apiKey fingerprint.
- Do not hard-code model IDs beyond the documented default fallback `composer-2.5`.
- Note: legacy `composer-2` / `composer-2-fast` IDs reroute to Composer 2.5 at auth time — prefer listing live IDs.

---

## 6. Module design

```
server/src/
  config.js                 # + Cursor env fields
  cursorSdkService.js       # NEW — adapter
  cursorWorkspace.js        # NEW — mkdir, write context files, cleanup
  ai.js                     # + provider validation, resolve Cursor key/model
  server.js                 # + routes + chat branch
  db.js / ai settings       # + allow provider cursor-sdk + optional key shape
```

### 6.1 `cursorSdkService.js` responsibilities

- Resolve API key (env → per-user).
- `listModels(apiKey)`.
- `runPrompt({ apiKey, model, prompt, cwd })` via `Agent.prompt` (smoke).
- `sendChat({ apiKey, model, prompt, agentId?, cwd, sessionId })`:
  - `Agent.resume(agentId, …)` when id present and valid; else `Agent.create({ local: { cwd, sandboxOptions, settingSources: [] }, model: { id }, apiKey })`.
  - `const run = await agent.send(prompt)`.
  - Log `agent.agentId` + `run.id` immediately.
  - Optionally consume `run.stream()` only to accumulate assistant text; still `await run.wait()`.
  - Return `{ status, message, agentId, runId, usage, latencyMs }`.
  - On non-retained runs: `await agent[Symbol.asyncDispose]()` (or `await using` in an async helper).
- Distinguish:
  - **Startup failure:** `CursorAgentError` → do not treat as model answer.
  - **Run failure:** `result.status === 'error'` → return structured error with ids.

### 6.2 `cursorWorkspace.js` responsibilities

- `createWorkspace({ userId, sessionId })` → absolute path.
- Write files such as:
  - `CONTEXT.md` — analyst instructions (read-only guidance for the agent).
  - `market.json` / `symbol.json` — optional snapshot from request context.
  - `portfolio.json` — only if explicitly requested and owned by `userId`.
- `destroyWorkspace(path)` after dispose (best-effort `rm -rf` under workspace root only; path-traversal guard).
- Never set `cwd` to the git repo root of DSE Toolkit in production.

### 6.3 Settings / DB

Today `saveUserAiSettings` rejects non-`openrouter` providers and requires `sk-or-` keys.

Extend carefully:

1. Allow `provider: 'openrouter' | 'cursor-sdk'`.
2. Key validation:
   - OpenRouter: existing `sk-or-` rule.
   - Cursor: non-empty string; optionally require `cursor_` prefix if that remains stable in docs (treat as soft check + clear error message).
3. `sanitizeAiSettings` must never return raw keys; only `configured: boolean`, `provider`, `model`.
4. Env `CURSOR_API_KEY` counts as configured for Cursor even when the user row has no key (same pattern as OpenRouter env fallback).

---

## 7. Frontend integration (phase 3)

Files likely touched: `settings.html`, `src/settingsApp.js`, `src/lib/appSettings.js`, `src/lib/serverClient.js`, `src/chatApp.js` (and market/stock server-mode callers if they hard-code OpenRouter).

### Settings UX

- When AI mode = server:
  - Provider select: OpenRouter | Cursor.
  - If Cursor: show “Server uses CURSOR_API_KEY” status when env-configured; optional “Save my Cursor API key” for phase B.
  - Model: load from Cursor models endpoint; include Auto if we define it as “server picks first/default from list” (not random OpenRouter auto unless we explicitly want parity).

### Chat UX

- Pass `provider: 'cursor-sdk'` when selected.
- Store `meta.agentId` / `meta.runId` on assistant messages; send `cursor.agentId` on follow-ups in the same thread.
- Clear/delete thread → call session reset so the server disposes the agent.
- Metadata panel: show provider, model, latency, optional token usage.

### Client mode

- No change: client mode stays OpenRouter-in-browser. Cursor SDK cannot run in the browser.

---

## 8. Phased implementation

### Phase 0 — Preconditions

- [ ] Confirm deploy target can run **Node ≥ 22.13** (local + Railway).
- [ ] Obtain a Cursor API key (user or service account) for staging.
- [ ] Read current `@cursor/sdk` install notes; pin a specific version in `server/package.json`.

### Phase 1 — Foundation (backend only)

- [ ] `npm install @cursor/sdk` in `server/`.
- [ ] Set `engines.node` to `>=22.13.0`; update README.
- [ ] Extend `config.js` with Cursor env vars.
- [ ] Add `cursorWorkspace.js` + `cursorSdkService.js`.
- [ ] Add test routes (health / models / prompt / chat / reset).
- [ ] Manual smoke via curl (see §10).
- [ ] Update `server/README.md` + `.env.example`.

**Phase 1 gate:** health + models + one-shot prompt succeed against staging key; workspace cleaned up; no writes outside workspace root.

### Phase 2 — Production chat wiring (backend)

- [ ] Extend `ai.js` provider + key resolution for `cursor-sdk`.
- [ ] Branch `POST /api/ai/chat` for Cursor.
- [ ] Models endpoint supports Cursor list (cached).
- [ ] Bounded agent cache + reset endpoint used by chat clear/delete.
- [ ] Unit/integration tests for message→prompt mapping, error mapping, path guards.

**Phase 2 gate:** authenticated chat with `provider: 'cursor-sdk'` returns assistant text compatible with existing response shape; OpenRouter path unchanged.

### Phase 3 — Frontend

- [ ] Settings provider picker + Cursor status/fields.
- [ ] `serverClient.js` helpers for Cursor models / chat payload.
- [ ] Chat (+ market/stock server flows) send Cursor provider when selected.
- [ ] Persist/resume `agentId` per thread; reset on clear/delete.
- [ ] Bump service worker cache versions after asset changes.

**Phase 3 gate:** full UI path works in server mode with Cursor selected; client/OpenRouter still work.

### Phase 4 — Hardening

- [ ] Sandbox + hooks verified (shell denied or jailed; no escape to `/`).
- [ ] TTL/max-size eviction for agent cache; dispose on process shutdown.
- [ ] Rate limits / concurrency cap per user (Cursor runs are heavier than OpenRouter HTTP).
- [ ] Observability: log `agentId`, `runId`, `userId`, latency, `result.status` (never log API keys).
- [ ] Respect `error.isRetryable` for transient failures.
- [ ] Privacy review: what context files may contain; retention of workspaces.

**Phase 4 gate:** load test a handful of concurrent Cursor chats without leaked child processes; `npm test` green.

### Phase 5 — Optional follow-ons (separate plans)

- SSE streaming of `run.stream()` assistant text.
- Per-user Cursor keys only (disable shared env key).
- MCP tools for live market JSON.
- Cloud runtime for batch jobs (not interactive chat).

---

## 9. Security & multi-tenant rules

1. **Never** run local agents with `cwd` = application source tree in production.
2. **Never** pass `local.settingSources: 'all'`.
3. **Sandbox + hooks** before exposing Cursor on a shared Railway instance.
4. Workspace paths must be resolved with `path.resolve` and verified to stay under `CURSOR_WORKSPACE_ROOT`.
5. Portfolio/context injection only for the authenticated `request.user.id`.
6. Keys: env or DB only; sanitize all GET settings responses.
7. Dispose agents; treat undisposed agents as a resource leak bug.
8. Billing: shared `CURSOR_API_KEY` bills the key owner — document that clearly in Settings copy if using a server-wide key.

---

## 10. Validation / smoke checklist

```bash
# 0) Node
node -v   # must be >= 22.13

# 1) Health
curl -s -H "Authorization: Bearer $JWT" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/health

# 2) Models
curl -s -H "Authorization: Bearer $JWT" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/models

# 3) One-shot prompt
curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/prompt \
  -d '{"model":"composer-2.5","prompt":"Reply with exactly: cursor-sdk-ok"}'

# 4) Production-shaped chat
curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/chat \
  -d '{
    "provider":"cursor-sdk",
    "model":"composer-2.5",
    "messages":[{"role":"user","content":"In one sentence, what is PE ratio?"}]
  }'
```

Also verify:

- [ ] OpenRouter chat still works with `provider: "openrouter"`.
- [ ] Copilot SDK test routes still respond (untouched).
- [ ] `npm test` (repo root) green after frontend phase.
- [ ] Process does not accumulate zombie agent/executor processes after 20 sequential chats.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| SDK is in public beta; APIs evolve | Pin version; wrap behind `cursorSdkService.js`; keep OpenRouter default |
| Node 22.13+ breaks current Node 20 assumption | Bump engines + Railway Node before coding features |
| Local agent can run shell/edit by default | Sandbox + deny hooks + ephemeral cwd only |
| Shared server key = shared billing / quota | Document; prefer per-user keys in phase B for multi-user |
| Latency much higher than OpenRouter chat | UI already shows pending assistant; set honest timeouts; concurrency limits |
| Platform native binaries fail on some hosts | Health check catches import/`acquire` failure early |
| Confusing Cursor SDK with Copilot SDK | Separate routes `/api/ai/cursor-sdk/*`; do not reuse Copilot modules |
| Resume without re-passing MCP/servers | v1 has no MCP; if added later, re-pass on `Agent.resume` |

---

## 12. Deliverables

1. This plan (living checklist).
2. Backend adapter + workspace helper + test routes.
3. `/api/ai/chat` Cursor branch + models listing.
4. Settings + chat wiring for provider selection.
5. README / `.env.example` updates.
6. Smoke evidence (curl) and green `npm test` after UI phase.

---

## 13. Definition of done

1. Phases 1–3 gates pass; Phase 4 hardening complete enough for staging.
2. OpenRouter (client + server) unchanged in behavior when selected.
3. Copilot backend code still present and untouched in behavior.
4. Cursor path: authenticated user can complete at least one analyst Q&A and one follow-up in the same thread via resumed `agentId`.
5. No API keys in logs or GET responses; workspaces cleaned up after dispose/reset.

---

## 14. Implementation order (cheat sheet)

1. Node/engine bump + install `@cursor/sdk`  
2. Config + workspace + service + test routes  
3. Smoke curls  
4. Chat + models production wiring  
5. Settings/UI + SW bump  
6. Sandbox/hooks/cache/rate limits  

Start coding only after Phase 0 (Node + API key) is confirmed on the target host.
