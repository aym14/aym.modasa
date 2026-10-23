# ANSAR YUVA MANDAL — Smart Ledger

A Gujarati, mobile-friendly ledger/PWA with offline browser storage, entry CRUD, reports, and cloud-sync providers. The browser app remains a single-file build in `index.html`; the backend in `server.js` is a small, testable Node.js service with no runtime dependencies.

## Run locally

Requirements: Node.js 18.18 or newer.

```sh
cp .env.example .env
# Set ACCESS_TOKEN to a long random value in .env.
npm install
npm start
```

The app is served at `http://localhost:8080`. `.env` is loaded by the server and must never be committed. Local ledger records are stored in `DATA_DIR/data-store.json`; the sample `.env` uses `DATA_DIR=./data`. If `DATA_DIR` is omitted, the server keeps the legacy `data-store.json` beside `server.js`. The server only serves allow-listed public assets, not `.env`, the data store, or source files. Runtime `sync-config.json` is ignored by Git; copy `sync-config.example.json` when needed. It is blocked by default; set `PUBLIC_SYNC_CONFIG=true` only when it contains no secrets and is safe to publish.

For production, set `ALLOWED_ORIGINS` to the exact app origin(s), use HTTPS, and keep `ACCESS_TOKEN` private. The cloud data API fails closed with `503` when `ACCESS_TOKEN` is unset. The token should be long and random, for example `openssl rand -hex 32`.

## Cloud data API

All data routes require `X-Access-Key: $ACCESS_TOKEN`.

| Method | Route | Behavior |
| --- | --- | --- |
| `POST` | `/api/data/:key` | Create a ledger record; returns `409` if the key already exists. |
| `GET` | `/api/data/:key` | Read a record, or `{ "record": null }` if it is absent. |
| `PUT` | `/api/data/:key` | Create or replace a record (upsert). |
| `DELETE` | `/api/data/:key` | Delete a record. |

`POST` and `PUT` accept `{ "record": { ... } }`. The app's existing My Server sync provider continues to use `GET` and `PUT`.

The optional Auto-SMS API uses short-lived, HttpOnly server sessions. Account registration requires the same `ACCESS_TOKEN` in `X-Access-Key`; the app sends it from the My Server provider configuration. Passwords are stored with scrypt; legacy SHA-256 server passwords are upgraded on successful login. SMS sending requires a valid session. Set `FAST2SMS_API_KEY` only on the server to enable sending. These service-account endpoints are for the app's existing Auto-SMS flow; they are separate from the app's offline ledger login.

## Browser-side provider security

JSONBin, GitHub, and Supabase sync run directly from the browser, so their credentials are stored in that browser's local storage and are not protected by the server's `.env`. A masked password field does not change that. Prefer the My Server provider for private ledger data. Join links can carry cloud credentials as an invitation, so treat them like passwords and share them only with intended users over a private channel.

A Supabase `anon` key is public by design. Keep Row Level Security enabled and do not use an unrestricted `USING (true)` policy for private financial data. This app does not use Supabase Auth to scope records to individual users; use the access-token-protected My Server provider for private data, or add a proper Supabase Auth/RLS design before exposing a Supabase table.

The app's existing admin/party login is an offline client-side gate, not a substitute for server-enforced authorization. Do not treat browser-local user roles as a security boundary for a public multi-tenant service.

## Quality checks

```sh
npm run lint       # ESLint for backend/tooling + syntax checks for inline app scripts
npm test           # API, auth-session, storage, and security regression tests
npm run check      # lint and tests together
```

The large inline app scripts are syntax-checked without changing the single-file deployment format. Backend, scripts, and tests are linted with ESLint. GitHub Actions runs `npm run check` on pushes and pull requests.
