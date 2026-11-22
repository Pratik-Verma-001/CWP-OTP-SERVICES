# CWP WhatsApp link worker

Links one WhatsApp number (QR scan or pairing code) and sends OTPs for the CWP dashboard.
This is an UNOFFICIAL method: WhatsApp can restrict or ban the number. Use a spare number, keep volume low.
It cannot run on Vercel (needs a process that stays running). Run it on a VPS, a home PC, or Termux.

## Run
```bash
cd worker
npm install            # Termux: run `pkg install git` first (a dependency is fetched from git)
set -a; . ./.env; set +a
node index.js          # keep running: pm2 start index.js --name cwp-wa  (VPS)
```
The session is stored in `worker/auth/` (never commit it). Back it up to avoid re-scanning.

## Connect to the dashboard
Dashboard > Providers > WhatsApp > Link device: enter this worker's public URL (https recommended; for a home/Termux
device use a tunnel such as Cloudflare Tunnel or ngrok) and the same `WORKER_SECRET`, then scan the QR or use the pairing code.
