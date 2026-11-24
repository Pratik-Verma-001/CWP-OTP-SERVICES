# Deployment guide

## 1. Supabase
1. Create a project. Copy the URL, publishable key, and secret key (Project Settings > API Keys).
2. SQL Editor: run `supabase/migrations/0001_init.sql`. Run migrations manually and never against production without a backup;
   review every future migration before running it.
3. Keep the secret key server-side only (Vercel env var). Never use it in client code.

## 2. Firebase
1. Authentication > Sign-in method: enable Email/Password. Create the admin user and verify its email.
2. Project settings > General: copy the web config into the `NEXT_PUBLIC_FIREBASE_*` variables.
3. Project settings > Service accounts: generate a key; copy `client_email` and `private_key` into
   `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` (keep the `\n` escapes). Delete old keys you no longer use.
4. Authentication > Settings > Authorized domains: add your Vercel domain.

## 3. GitHub
```bash
git init && git add . && git commit -m "CWP OTP API"
git branch -M main && git remote add origin https://github.com/<you>/cwp-otp-api.git && git push -u origin main
```
`.env*` files are git-ignored (only `.env.example` is committed). Check `git status` shows no secrets before pushing.

## 4. Vercel
1. Import the GitHub repo. Framework: Next.js.
2. Add every variable from `.env.example` under Settings > Environment Variables (Production and Preview).
   Generate a new `CRON_SECRET`. Set `APP_URL` to the production URL.
3. Deploy. Pushes to `main` deploy to production; other branches get preview deployments.
4. Test: `curl https://<app>/api/v1/health`, log in, create a project and key, configure SMTP, send a test OTP.
5. Monitor: Vercel > Logs, and the OTP Logs / Analytics pages. `vercel.json` runs a daily cleanup of old OTP rows.

## 5. WhatsApp (optional)
Needs a Meta Business account, WhatsApp Business Platform phone number, and an approved **authentication** template.
Webhook URL: `https://<app>/api/v1/webhooks/whatsapp`; set `WHATSAPP_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` to match Meta's app settings.

## Limits and costs (verify current terms; they change)
- **SMTP:** consumer mailboxes (e.g. Gmail) cap daily sends and can suspend accounts that send bulk or automated mail. Use a dedicated
  mailbox with an app password; for volume, use a proper SMTP service. Deliverability (SPF/DKIM) is your responsibility.
- **Vercel Hobby:** free tier is intended for personal, non-commercial use; function time, bandwidth and cron frequency are limited.
- **Supabase free:** limited database size and bandwidth; inactive free projects may be paused.
- **Firebase Auth:** free for email/password within its quota.
- **WhatsApp:** template messages are charged per message by Meta; authentication templates have their own pricing and policies.
This platform does not provide unlimited free OTP delivery.
