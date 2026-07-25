# DSE Toolkit Server

Optional Fastify + SQLite backend for server-backed stock and mutual fund portfolios.

## Requirements

- Node.js 20+ (tested on Node 25)

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Set the environment variables before starting:

- `PORT`: HTTP port, defaults to `3001`
- `DB_PATH`: SQLite database path, defaults to `./data/app.db`
- `JWT_SECRET`: required signing secret for JWTs
- `CORS_ORIGIN`: allowed frontend origin, defaults to `*`
- `COPILOT_SDK_LOG_LEVEL`: Copilot SDK/CLI log level, defaults to `info`
- `GITHUB_OAUTH_CLIENT_ID`: GitHub OAuth app client ID for user-authenticated Copilot SDK
- `GITHUB_OAUTH_CLIENT_SECRET`: GitHub OAuth app client secret
- `GITHUB_OAUTH_REDIRECT_URI`: OAuth callback URL (must match OAuth app setting)
- `GITHUB_OAUTH_SCOPES`: OAuth scopes, defaults to `read:user read:org`
- `GITHUB_OAUTH_REQUIRED_ORG`: optional org slug required for access
- `GITHUB_OAUTH_AUTHORIZE_URL`: defaults to `https://github.com/login/oauth/authorize`
- `GITHUB_OAUTH_TOKEN_URL`: defaults to `https://github.com/login/oauth/access_token`
- `GITHUB_OAUTH_STATE_SECRET`: optional HMAC secret for OAuth state signing (falls back to JWT secret)
- `GITHUB_COPILOT_BASE_URL`: GitHub Models API base URL, defaults to `https://models.github.ai`
- `GITHUB_COPILOT_API_KEY`: optional token used by `src/copilotClient.js` (needs `models:read` permission)
- `GITHUB_COPILOT_MODEL`: default model for test chat endpoint, defaults to `gpt-4o-mini`
- `GITHUB_COPILOT_API_VERSION`: GitHub Models API version header, defaults to `2026-03-10`
- `GITHUB_COPILOT_ORG`: optional org attribution for inference calls
- `OPENROUTER_BASE_URL`: OpenRouter API base URL, defaults to `https://openrouter.ai/api/v1`
- `OPENROUTER_API_KEY`: backend OpenRouter key for server-side AI mode
- `OPENROUTER_LOG_PATH`: optional log path for OpenRouter request/response logs

## Run

```bash
npm run dev
```

or

```bash
npm start
```

## API

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/portfolio/stocks`
- `PUT /api/portfolio/stocks`
- `GET /api/portfolio/funds`
- `PUT /api/portfolio/funds`
- `GET /api/ai/settings`
- `PUT /api/ai/settings`
- `POST /api/ai/chat`
- `GET /api/ai/copilot-sdk/oauth/start`
- `GET /api/ai/copilot-sdk/oauth/callback`
- `DELETE /api/ai/copilot-sdk/oauth`
- `GET /api/ai/copilot-sdk/test/health`
- `GET /api/ai/copilot-sdk/test/user`
- `GET /api/ai/copilot-sdk/test/models`
- `POST /api/ai/copilot-sdk/test/chat`
- `GET /api/ai/models?provider=openrouter|cursor-sdk`
- `GET /api/ai/settings`
- `PUT /api/ai/settings`
- `POST /api/ai/chat` (supports SSE streaming)
- `POST /api/ai/cursor-sdk/session/reset`
- `GET /api/ai/cursor-sdk/test/health`
- `GET /api/ai/cursor-sdk/test/models`
- `POST /api/ai/cursor-sdk/test/prompt`
- `POST /api/ai/cursor-sdk/test/chat`
- `POST /api/ai/cursor-sdk/test/session/reset`

Portfolio and AI endpoints require `Authorization: Bearer <token>`.

AI notes:
- Providers supported: `openrouter` and `cursor-sdk`.
- Cursor SDK runs local sandboxed agents per user session under `CURSOR_WORKSPACE_ROOT`.
- SSE streaming is supported on `POST /api/ai/chat` for both providers.
- Copilot test endpoints call GitHub Models APIs directly using server env credentials.

## Cursor SDK test API examples

```bash
# 1) Health
curl -s -H "Authorization: Bearer $JWT" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/health

# 2) Models list
curl -s -H "Authorization: Bearer $JWT" \
  "http://127.0.0.1:3001/api/ai/models?provider=cursor-sdk"

# 3) Test Prompt
curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/test/prompt \
  -d '{"model":"composer-2.5","prompt":"Reply with exactly: cursor-sdk-ok"}'

# 4) Streaming SSE Chat
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

# 5) Reset Session
curl -s -X POST -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  http://127.0.0.1:3001/api/ai/cursor-sdk/session/reset \
  -d '{"sessionId":"smoke-thread-1"}'
```

## Copilot SDK OAuth flow (backend-only test)

1. Authenticate into this server using `/api/auth/login` and save your JWT.
2. Call `GET /api/ai/copilot-sdk/oauth/start` with `Authorization: Bearer <jwt>`.
3. Open `authorizeUrl` from response in browser and approve OAuth.
4. GitHub redirects to `/api/ai/copilot-sdk/oauth/callback` and stores your token for your server user.
5. Call Copilot SDK test APIs below.

## Copilot SDK test API examples

```bash
# 1) Health
curl -s \
	-H "Authorization: Bearer $JWT" \
	http://127.0.0.1:3001/api/ai/copilot-sdk/test/health

# 2) Auth status/user
curl -s \
	-H "Authorization: Bearer $JWT" \
	http://127.0.0.1:3001/api/ai/copilot-sdk/test/user

# 3) Models list
curl -s \
	-H "Authorization: Bearer $JWT" \
	http://127.0.0.1:3001/api/ai/copilot-sdk/test/models

# 4) Chat
curl -s \
	-X POST \
	-H "Authorization: Bearer $JWT" \
	-H "Content-Type: application/json" \
	http://127.0.0.1:3001/api/ai/copilot-sdk/test/chat \
	-d '{
		"model": "gpt-4.1",
		"sessionId": "manual-test",
		"prompt": "Say hello from Copilot SDK"
	}'

# 5) Reset session
curl -s \
	-X POST \
	-H "Authorization: Bearer $JWT" \
	-H "Content-Type: application/json" \
	http://127.0.0.1:3001/api/ai/copilot-sdk/test/session/reset \
	-d '{"sessionId": "manual-test"}'
```
