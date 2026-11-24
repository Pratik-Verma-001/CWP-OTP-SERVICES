# Production security checklist
- [ ] All secrets only in Vercel env vars; `.env.local` never committed or shared
- [ ] Rotated any key that was ever pasted in chat/email (Firebase service account, Supabase secret key)
- [ ] `API_KEY_PEPPER`, `OTP_HMAC_SECRET`, `ENCRYPTION_KEY` generated randomly and backed up (changing them invalidates keys / stored credentials)
- [ ] `ADMIN_ALLOWLIST` contains only real admins; each has a verified email and a strong password
- [ ] Supabase RLS enabled on all tables (migration does this); no public policies added
- [ ] Firebase authorized domains limited to your domains
- [ ] Per-project `allowed_origins` set; API keys used only from servers
- [ ] SMTP uses an app password on a dedicated mailbox; SPF/DKIM configured
- [ ] `CRON_SECRET` set; cleanup cron running
- [ ] Reviewed Vercel logs: no OTP codes or secrets appear (the app never logs them)
- [ ] `npm run typecheck && npm test` pass before every deploy
Known limits: rate limits are database-backed (adequate for modest traffic); add a CDN/WAF for heavy abuse. No CSP header is set yet.
