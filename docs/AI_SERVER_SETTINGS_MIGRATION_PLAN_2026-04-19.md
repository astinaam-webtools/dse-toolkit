# AI Settings + Server Analyst Migration Plan (2026-04-19)

## Goal
1. Show quick market filter controls in Screener view only.
2. Move AI API configuration to Settings page (centralized).
3. Add server-backed AI analyst mode (OpenRouter only, initial implementation).
4. Keep client-only AI mode available.
5. Bump service worker versions after asset/runtime changes.

## Implementation Steps

### Phase 1: Market UI Scope Fix
- [x] Move quick filter UI and result summary from global header to Screener view.
- [x] Ensure quick filters only affect Screener rendering.

### Phase 2: App Settings Model
- [x] Extend app settings schema with AI config:
  - [x] mode: `client` | `server`
  - [x] local OpenRouter key/model for client mode
- [x] Add helper functions for reading/updating AI settings.

### Phase 3: Settings Page UX
- [x] Add AI Analyst section near top of Settings page.
- [x] Add controls for mode selection and provider/model fields.
- [x] In server mode, show server-key save action and status.

### Phase 4: Server Endpoints (OpenRouter Only)
- [x] Add DB table for per-user AI provider settings.
- [x] Add authenticated endpoints:
  - [x] `GET /api/ai/settings`
  - [x] `PUT /api/ai/settings` (OpenRouter key + model)
  - [x] `POST /api/ai/chat` (messages -> OpenRouter)
- [x] Wire routes in Fastify server and validation/error handling.

### Phase 5: Client AI Wiring
- [x] Remove local API settings modal from `market.html`.
- [x] Update market/stock AI flows:
  - [x] `client` mode: call OpenRouter directly using local settings from Settings page.
  - [x] `server` mode: call backend AI endpoint.

### Phase 6: Service Worker + Validation
- [x] Bump `src/swRegister.js` version tag.
- [x] Bump `sw.js` cache names.
- [x] Run tests (`npm test`) and basic diagnostics.
- [x] Mark this plan complete.
