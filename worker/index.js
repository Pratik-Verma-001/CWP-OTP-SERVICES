// CWP WhatsApp worker (v2). It connects OUT to your CWP app, so you need no tunnel and no changing URL.
// UNOFFICIAL (WhatsApp Web protocol): WhatsApp may restrict or ban the number. Use a spare number.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import fs from "fs";
import { createDecipheriv, createHash } from "crypto";

const VERSION = "2.0.0";
const APP = (process.env.APP_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.WORKER_TOKEN || "";
const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const MAX_PER_MIN = Number(process.env.MAX_PER_MIN || 15);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
if (!APP || !TOKEN) { console.error("Missing APP_URL or WORKER_TOKEN. Put them in worker/.env (token: Administration > WhatsApp > Generate token)."); process.exit(1); }

const KEY = createHash("sha256").update("cwp-wa-job:" + TOKEN).digest();
const open = (sealed) => {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", KEY, iv); d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bad = (code) => Object.assign(new Error(code), { code });
const REASONS = {
  401: "Logged out from the phone. Link again.", 405: "WhatsApp rejected this client version. Update: npm i @whiskeysockets/baileys@latest",
  408: "QR was not scanned in time. A new one is being created.", 411: "Multi-device mismatch. Unlink and link again.",
  428: "Connection closed. Reconnecting.", 440: "Another session replaced this one. Unlink it on the phone and link again.",
  500: "Bad session. Unlink and link again.", 515: "Restarting after pairing.",
};

let sock = null, state = "disconnected", qr = null, phone = null, starting = false, lastError = null, retries = 0;
const sentAt = [];

async function call(path, body) {
  const r = await fetch(APP + path, { method: "POST", headers: { "x-worker-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(30000) });
  if (r.status === 401) throw new Error("401: token rejected. Generate a new token in the dashboard and update worker/.env");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const report = (qrNew = false) => call("/api/worker/status", { state, qr, phone, error: lastError, version: VERSION, qrNew }).catch(() => {});

async function start() {
  if (sock || starting) return;
  starting = true; state = "connecting";
  try {
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const s = makeWASocket({ version, auth, logger: pino({ level: "silent" }), browser: Browsers.ubuntu("Chrome"), markOnlineOnConnect: false, syncFullHistory: false });
    sock = s;
    s.ev.on("creds.update", saveCreds);
    s.ev.on("connection.update", async (u) => {
      if (s !== sock) return; // ignore events from a socket we already replaced
      if (u.qr) {
        qr = await QRCode.toDataURL(u.qr, { margin: 2, width: 360, errorCorrectionLevel: "M" });
        state = "qr"; lastError = null; retries = 0; log("QR ready: scan it from the dashboard"); report(true);
      }
      if (u.connection === "open") {
        state = "connected"; qr = null; lastError = null; retries = 0;
        phone = (s.user?.id || "").split(":")[0].split("@")[0] || null; log("WhatsApp linked:", phone); report();
      }
      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const why = REASONS[code] || `Connection closed (code ${code ?? "unknown"}). Reconnecting.`;
        log("connection closed:", code, why);
        sock = null; qr = null; phone = null;
        if (code === DisconnectReason.loggedOut) { state = "disconnected"; lastError = why; fs.rmSync(AUTH_DIR, { recursive: true, force: true }); }
        else { state = "connecting"; lastError = code === DisconnectReason.restartRequired || code === 408 ? null : why; setTimeout(start, code === DisconnectReason.restartRequired ? 300 : Math.min(30000, 2000 * ++retries)); }
        report();
      }
    });
  } catch (e) { log("start failed:", e.message); lastError = "Could not start WhatsApp: " + String(e.message).slice(0, 100); sock = null; state = "disconnected"; report(); }
  starting = false;
}
async function stop() { const s = sock; sock = null; try { s?.end(undefined); } catch {} }
const waitFor = async (pred, ms) => { for (let t = 0; t < ms && !pred(); t += 500) await sleep(500); };

async function handle(job) {
  const p = job.payload ? open(job.payload) : {};
  if (job.kind === "qr") {
    if (state === "connected") return { state };
    await stop(); qr = null; state = "connecting"; await start(); // always a fresh QR
    await waitFor(() => state === "qr" || state === "connected", 15000);
    return { state };
  }
  if (job.kind === "code") {
    if (state === "connected") throw bad("ALREADY_LINKED");
    const num = String(p.phone || "").replace(/\D/g, "");
    if (num.length < 8 || num.length > 15) throw bad("INVALID_PHONE");
    if (state !== "qr") { await stop(); await start(); await waitFor(() => state === "qr", 15000); }
    if (!sock || state !== "qr") throw bad("NOT_READY");
    return { code: String(await sock.requestPairingCode(num)).match(/.{1,4}/g).join("-") };
  }
  if (job.kind === "logout") {
    try { await sock?.logout(); } catch {}
    await stop(); state = "disconnected"; qr = null; phone = null; lastError = null;
    fs.rmSync(AUTH_DIR, { recursive: true, force: true }); report();
    return { state };
  }
  if (job.kind === "send") {
    if (state !== "connected" || !sock) throw bad("NOT_LINKED");
    const now = Date.now();
    while (sentAt.length && now - sentAt[0] > 60000) sentAt.shift();
    if (sentAt.length >= MAX_PER_MIN) throw bad("RATE_LIMITED");
    const num = String(p.to || "").replace(/\D/g, "");
    if (num.length < 8 || num.length > 15 || !p.text) throw bad("INVALID_REQUEST");
    const [r] = (await sock.onWhatsApp(num)) || [];
    if (!r?.exists) throw bad("NOT_ON_WHATSAPP");
    sentAt.push(now);
    const m = await sock.sendMessage(r.jid, { text: String(p.text).slice(0, 500) }); // message text is never logged
    return { messageId: m?.key?.id };
  }
  throw bad("UNKNOWN_JOB");
}

async function main() {
  log(`CWP WhatsApp worker v${VERSION} -> ${APP}`);
  if (fs.existsSync(`${AUTH_DIR}/creds.json`)) { log("Saved session found, reconnecting..."); start(); }
  let first = true;
  for (;;) {
    try {
      const { job, nextMs } = await call("/api/worker/poll", { state, qr, phone, error: lastError, version: VERSION });
      if (first) { log("Connected to the app. Waiting for work."); first = false; }
      if (!job) { if (nextMs) await sleep(nextMs); continue; }
      log("job:", job.kind);
      let ok = true, result;
      try { result = await handle(job); } catch (e) { ok = false; result = { error: String(e.code || "FAILED").slice(0, 40) }; if (!e.code) log("job failed:", e.message); }
      await call("/api/worker/result", { id: job.id, ok, result }).catch((e) => log("result:", e.message));
    } catch (e) { log("cannot reach the app:", e.message); first = true; await sleep(5000); }
  }
}
main();
