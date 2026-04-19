# Unified AI Chat Plan (Autopilot) — 2026-04-19

## Goal
Ship a dedicated, shared AI chat experience across the app with backend model APIs, robust offline-first behavior, thread persistence, and sync support.

## Scope
- Backend OpenRouter core module abstraction for chat completion
- Backend model-list endpoint using `server/src/models.js`
- Backend chat endpoint enhancements for model metadata and auto mode
- Dedicated frontend chat page replacing modal chat UX
- Shared prompt/context builder used by Market and Stock detail entry points
- Model picker in chat UI (server mode) with Auto mode
- Offline-only behavior showing selected model from settings
- Per-thread clear/delete support with correct context reset
- Chat thread local persistence + pending sync + flush when server connected
- Response metadata panel (model, latency/time, source)
- Navigation integration and back behavior preservation

## Architecture Decisions
1. Create `chat.html` + `src/chatApp.js` as the single chat surface.
2. Keep page-entry context via URL params (`symbol`, `source`, `returnTo`) and bootstrap prompts in shared lib.
3. Add `src/lib/chatStore.js` for local thread DB + sync flags and upload helpers.
4. Add dedicated server chat thread document type (`chat_threads`) to reuse existing document storage pipeline.
5. Add server endpoint `GET /api/ai/models` from `server/src/models.js`.
6. Add server chat request contract:
   - request: `{ provider, messages, model, mode }`
   - response: `{ provider, model, message, meta: { latencyMs, respondedAt, mode, source } }`
7. Auto mode behavior (server-connected): on new thread pick random model from server model list.

## Implementation Steps
- [ ] Backend: add OpenRouter core module and wire ai service to use it.
- [ ] Backend: expose `/api/ai/models` endpoint from `models.js`.
- [ ] Backend: extend document types/validators for `chat_threads` payload.
- [ ] Frontend: add chat storage/sync library (`chatStore.js`).
- [ ] Frontend: add AI model client helpers in `serverClient.js`.
- [ ] Frontend: add dedicated `chat.html` + visual redesign + metadata panel.
- [ ] Frontend: implement `chatApp.js` (thread list, model picker, auto mode, delete/clear, send, sync).
- [ ] Frontend: remove modal chat from `market.html` and `stock.html`, replace with deep links to `chat.html`.
- [ ] Frontend: move duplicated prompt generation into shared prompt utility.
- [ ] Offline-first: guard server calls, queue thread sync, flush on reconnect/login.
- [ ] PWA: update service worker cache list and versions for new assets.
- [ ] Validation: run diagnostics + tests and patch fallout.

## Success Criteria
- One shared chat page works from both Market and Stock pages.
- Server mode: model picker loads from backend, supports Auto + manual + mid-conversation switch.
- Offline/client-only: selected model shown from settings and used correctly.
- Thread clear/delete works and subsequent prompts include correct base context/history.
- Threads persist locally and sync to server document when connected.
- Metadata visible per assistant response.
