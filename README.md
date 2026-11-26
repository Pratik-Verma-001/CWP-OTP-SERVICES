# CWP OTP API

Self-managed OTP delivery and verification platform: Next.js (App Router) + Supabase PostgreSQL + Firebase admin auth,
Email OTP over your own SMTP account, WhatsApp OTP over the official Cloud API.

## Quick start (local)
```bash
npm install
cp .env.example .env.local      # fill every value; generate secrets with: openssl rand -hex 32
# Supabase: SQL editor -> run supabase/migrations/0001_init.sql once
npm run dev                      # http://localhost:3000
npm run typecheck && npm test
```
Sign in at `/login` with a Firebase Email/Password user whose (verified) email is listed in `ADMIN_ALLOWLIST`.

## Using the API
See the in-dashboard **API Docs** page. Summary: `POST /api/v1/otp/send`, `POST /api/v1/otp/verify`,
`GET /api/v1/usage`, `GET /api/v1/health`, header `x-api-key: cwp_live_...`. Call it from your server, never from browser code.

## Layout
- `app/api/v1/*` public API, `app/api/admin/*` admin API (Firebase token + allowlist), `app/dashboard/*` UI
- `lib/otp` engine, `lib/smtp`, `lib/whatsapp`, `lib/api-keys`, `lib/security`, `lib/auth`
- `supabase/migrations` schema (RLS on, no public policies), `tests/` vitest suite (all mocked, never sends real messages)

Deployment: see `docs/DEPLOYMENT.md`. Security checklist: `docs/SECURITY.md`.

Live app: https://cwp-otp-service.vercel.app
Database: run `supabase/migrations/0001_init.sql`, then `0002_project_smtp.sql` (per-project email senders).

## Panels
- **User panel** `/dashboard`: projects, API keys, own email sender, test OTP, logs, analytics, docs.
- **Administration** `/administration` (owners/admins only): users (approve, suspend, edit, delete, features, limits, usage and activity),
  feature flags, WhatsApp worker (permanent URL + token + QR/pairing code), platform email, platform settings, audit log.
- Emails in `ADMIN_ALLOWLIST` are always active owners. Everyone else signs up at `/register` (approval mode by default).
- Run migrations in order: `0001_init.sql`, `0002_project_smtp.sql`, `0003_platform.sql`.
- WhatsApp worker: see `worker/README.md` (it connects out to the app, no tunnel needed).

## Single administrator (important)
There is exactly ONE platform administrator, signing in at `/administration/login` with dedicated credentials
(`ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`). It is not a user account. Users cannot reach the admin area and
every `/api/administration/*` route verifies the signed session cookie on the server. Generate the hash with
`node scripts/make-admin-hash.mjs "your password"`. `ADMIN_ALLOWLIST` is no longer used.
Documentation for integrators is public at `/docs`. Run `0004_single_admin.sql` after `0003`.
