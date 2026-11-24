// CWP WhatsApp worker. It connects OUT to your CWP app (long-polling), so you do not need a tunnel or a changing URL.
// The app URL is the permanent worker URL. Unofficial (WhatsApp Web protocol): the number can be restricted or banned.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import fs from "fs";
import { createDecipheriv, createHash } from "crypto";

const APP = (process.env.APP_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.WORKER_TOKEN || "";
const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const MAX_PER_MIN = Number(process.env.MAX_PER_MIN || 15);
if (!APP || !TOKEN) { console.error("Set APP_URL and WORKER_TOKEN in worker/.env (token: Administration > WhatsApp Worker)."); process.exit(1); }

const KEY = createHash("sha256").update("cwp-wa-job:" + TOKEN).digest();
const open = (sealed) => {
  const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", KEY, iv); d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString("utf8"));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bad = (code) => Object.assign(new Error(code), { code });

let sock = null, state = "disconnected", qr = null, phone = null, starting = false;
const sentAt = [];

async function call(path, body) {
  const r = await fetch(APP + path, { method: "POST", headers: { "x-worker-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(30000) });
  if (r.status === 401) throw new Error("401 token rejected: generate a new token in the dashboard and update worker/.env");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const report = () => call("/api/worker/status", { state, qr, phone }).catch(() => {});

async function start() {
  if (sock || starting) return;
  starting = true; state = "connecting";
  try {
    const { state: auth, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();
    const s = makeWASocket({ version, auth, logger: pino({ level: "silent" }), browser: Browsers.ubuntu("Chrome"), markOnlineOnConnect: false });
    sock = s;
    s.ev.on("creds.update", saveCreds);
    s.ev.on("connection.update", async (u) => {
      if (u.qr) { qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 }); state = "qr"; report(); }
      if (u.connection === "open") { state = "connected"; qr = null; phone = (s.user?.id || "").split(":")[0].split("@")[0] || null; report(); }
      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        sock = null; qr = null; phone = null;
        if (code === DisconnectReason.loggedOut) { state = "disconnected"; fs.rmSync(AUTH_DIR, { recursive: true, force: true }); }
        else { state = "connecting"; setTimeout(start, 3000); }
        report();
      }
    });
  } catch (e) { console.error("start failed:", e.message); sock = null; state = "disconnected"; }
  starting = false;
}
const waitFor = async (pred, ms) => { for (let t = 0; t < ms && !pred(); t += 500) await sleep(500); };

async function handle(job) {
  const p = job.payload ? open(job.payload) : {};
  if (job.kind === "qr") {
    if (state !== "connected") { await start(); await waitFor(() => state === "qr" || state === "connected", 12000); }
    return { state };
  }
  if (job.kind === "code") {
    if (state === "connected") throw bad("ALREADY_LINKED");
    const num = String(p.phone || "").replace(/\D/g, "");
    if (num.length < 8 || num.length > 15) throw bad("INVALID_PHONE");
    await start(); await waitFor(() => state === "qr", 12000);
    if (!sock || state !== "qr") throw bad("NOT_READY");
    return { code: String(await sock.requestPairingCode(num)).match(/.{1,4}/g).join("-") };
  }
  if (job.kind === "logout") {
    try { await sock?.logout(); } catch {}
    sock = null; state = "disconnected"; qr = null; phone = null;
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
  console.log("CWP WhatsApp worker started. Connecting to", APP);
  if (fs.existsSync(`${AUTH_DIR}/creds.json`)) start();
  for (;;) {
    try {
      const { job } = await call("/api/worker/poll", { state, qr, phone });
      if (!job) continue;
      let ok = true, result;
      try { result = await handle(job); } catch (e) { ok = false; result = { error: String(e.code || "FAILED").slice(0, 40) }; if (!e.code) console.error("job failed:", e.message); }
      await call("/api/worker/result", { id: job.id, ok, result }).catch((e) => console.error("result:", e.message));
    } catch (e) { console.error("poll:", e.message); await sleep(5000); }
  }
}
main();
