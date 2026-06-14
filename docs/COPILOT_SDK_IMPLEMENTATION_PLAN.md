# Copilot SDK Integration Plan (Server)

## Objective
Integrate GitHub Copilot SDK with GitHub OAuth in the backend so each authenticated app user can run Copilot-backed requests using their own GitHub account, while preserving existing OpenRouter and GitHub Models REST test paths.

## Scope
- Add OAuth endpoints and token exchange flow.
- Persist per-user GitHub OAuth tokens in SQLite.
- Implement Copilot SDK client manager bound to user tokens.
- Expose pre-integration test APIs for health, user identity, model list, and chat.
- Keep frontend unchanged for now; backend-only validation first.

## Phases

### Phase 1: Configuration and Dependencies
- Add SDK dependency (`@github/copilot-sdk`).
- Add OAuth/env config:
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `GITHUB_OAUTH_REDIRECT_URI`
  - `GITHUB_OAUTH_SCOPES`
  - `GITHUB_OAUTH_REQUIRED_ORG` (optional)

### Phase 2: Data Model
- Add table for per-user GitHub auth records:
  - `user_id` (unique FK)
  - `provider` (`github-oauth`)
  - `access_token`
  - `token_type`
  - `scope`
  - `github_login`
  - `github_id`
  - timestamps
- Add helpers to upsert/read/delete auth records.

### Phase 3: OAuth Flow
- Add endpoint to generate GitHub authorize URL for logged-in users.
- Add callback endpoint to exchange code for token via GitHub OAuth.
- Fetch GitHub user identity (`/user`) and optionally verify org membership (`/user/orgs`).
- Save token and profile to DB.

### Phase 4: Copilot SDK Adapter
- Add adapter that creates per-user Copilot client using OAuth token.
- Disable logged-in-user fallback in SDK options.
- Add methods:
  - `sendPrompt()`
  - `listModels()` (if available from SDK; fallback handled)
  - session cleanup hooks

### Phase 5: Test APIs (Before Frontend Integration)
- `GET /api/ai/copilot-sdk/test/health`
- `GET /api/ai/copilot-sdk/test/user`
- `GET /api/ai/copilot-sdk/test/models`
- `POST /api/ai/copilot-sdk/test/chat`
- `POST /api/ai/copilot-sdk/test/session/reset`

### Phase 6: Validation
- Run static error checks on changed files.
- Run smoke checks from terminal:
  1. login/signup
  2. OAuth start URL
  3. callback token exchange (manual with code)
  4. test user/models/chat routes

## Risks and Notes
- SDK is in preview; APIs can evolve.
- OAuth token lifecycle/refresh is app responsibility.
- Organization-restricted deployments should enforce org check in callback.
- In local development, callback URL must match OAuth app settings exactly.

## Deliverables
- Backend code for OAuth + SDK integration.
- Updated env example and server README with setup + test API commands.
- Verified backend test routes ready for frontend integration.
