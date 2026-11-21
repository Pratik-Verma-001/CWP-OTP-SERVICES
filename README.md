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
