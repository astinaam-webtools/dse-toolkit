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
- `OPENROUTER_BASE_URL`: OpenRouter API base URL, defaults to `https://openrouter.ai/api/v1`

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

Portfolio and AI endpoints require `Authorization: Bearer <token>`.

AI notes:
- Initial provider support is `openrouter` only.
- Save OpenRouter key via `PUT /api/ai/settings` before calling `POST /api/ai/chat`.
