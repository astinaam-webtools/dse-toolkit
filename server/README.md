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

All portfolio endpoints require `Authorization: Bearer <token>`.
