# Crowdsourced Internet Backend (No P2P, No Postgres)

Centralized backend for a crowdsourced-internet demo: providers share bandwidth via access codes, 
consumers redeem codes, a gateway reports usage, providers earn **points** (not tokens), and 
a real-time chat runs on WebSockets — all **without P2P** and **without Postgres** (uses MongoDB).

## Quick Start

### Option A — Docker (recommended)
```bash
docker compose up -d
```
API on `http://localhost:8080`

### Option B — Local Node
```bash
cp .env.example .env
npm install
npm run dev
```

### Seed (creates admin + demo provider/consumer + codes)
```bash
npm run seed
```

### Agent Simulator (reports usage to backend)
```bash
# Requires .env to be configured and server running
npm run agent
```

## API Overview
- `POST /api/auth/register`          – register user with role: provider | consumer | admin
- `POST /api/auth/login`             – login, returns JWT
- `GET  /api/auth/me`                – current user

- `POST /api/provider/codes`         – [provider] create access code(s)
- `GET  /api/provider/codes`         – [provider] list own codes
- `GET  /api/provider/usage`         – [provider] usage dashboard

- `POST /api/consumer/redeem`        – [consumer] redeem code
- `GET  /api/consumer/balance`       – [consumer] remaining MB across codes

- `POST /api/gateway/authorize-code` – [provider/admin] validate a code (for captive portal/gateway)
- `POST /api/gateway/report-usage`   – [provider/admin] report bytes usage against code

- `GET  /api/leaderboard`            – top providers by points

## WebSocket Chat
- Namespace: `/chat`
- Rooms: `room:<providerId>` or `code:<accessCode>`
- Events: `join`, `message`, `history`

## Roles
- **provider** – creates access codes, runs gateway/agent, earns points.
- **consumer** – redeems access codes, uses bandwidth.
- **admin**    – can do everything providers can; future moderation.

## Deploy to Railway
- Create a new service from this repo/zip.
- Set ENV:
  - `MONGODB_URI` (e.g., MongoDB Atlas connection string)
  - `JWT_SECRET`
  - `CORS_ORIGIN` (e.g., `*` or your frontend URL)
  - `PORT` = `8080`
- Build command: `npm ci && npm run build` (no build needed, you can omit)
- Start command: `npm start`

## License
MIT
