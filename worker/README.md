# CWP WhatsApp worker

Links one WhatsApp number (QR scan or pairing code) and sends OTPs for your CWP app.
It connects OUT to the app, so there is no tunnel and the URL never changes (it is your app URL).
UNOFFICIAL method: WhatsApp can restrict or ban the number. Use a spare number and keep volume low.
It must stay running (a VPS, a home PC, or Termux).

## Setup
1. Dashboard > Administration > WhatsApp Worker > "Generate token". Copy the token.
2. Put it in `worker/.env`:  `WORKER_TOKEN=cwpw_...`  (`APP_URL` is already set)
3. Run:
```bash
cd worker
npm install            # Termux: `pkg install git nodejs` first
set -a; . ./.env; set +a
node index.js          # VPS: pm2 start index.js --name cwp-wa
```
4. In the dashboard the worker shows "Online". Press "Show QR code" or use the pairing code, then link from WhatsApp.

The session is kept in `worker/auth/` (never commit it). Rotating the token in the dashboard disconnects old workers.
