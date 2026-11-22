// CWP WhatsApp link worker: links ONE WhatsApp number to this server (QR or pairing code)
// and sends OTP messages on request from the CWP dashboard/API.
// Unofficial (WhatsApp Web protocol): the number can be restricted or banned by WhatsApp. Use a spare number.
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import http from "http";
import fs from "fs";
import { timingSafeEqual } from "crypto";

const PORT = Number(process.env.PORT || 3001);
const SECRET = process.env.WORKER_SECRET || "";
const AUTH_DIR = process.env.AUTH_DIR || "./auth";
const MAX_PER_MIN = Number(process.env.MAX_PER_MIN || 15);
if (SECRET.length < 16) { console.error("Set WORKER_SECRET (16+ characters) in worker/.env"); process.exit(1); }

let sock = null, state = "disconnected", qr = null, phone = null, starting = false;
const sentAt = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const status = () => ({ state, qr, phone });

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
      if (u.qr) { qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 320 }); state = "qr"; }
      if (u.connection === "open") { state = "connected"; qr = null; phone = (s.user?.id || "").split(":")[0].split("@")[0] || null; }
      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        sock = null; qr = null; phone = null;
        if (code === DisconnectReason.loggedOut) { state = "disconnected"; fs.rmSync(AUTH_DIR, { recursive: true, force: true }); }
        else { state = "connecting"; setTimeout(start, 3000); }
      }
    });
  } catch (e) { console.error("start failed:", e.message); sock = null; state = "disconnected"; }
  starting = false;
}

async function waitFor(pred, ms = 15000) { for (let t = 0; t < ms && !pred(); t += 500) await sleep(500); }

async function pairingCode(num) {
  if (state === "connected") throw Object.assign(new Error("linked"), { status: 409, code: "ALREADY_LINKED" });
  await start();
  await waitFor(() => state === "qr");
  if (!sock || state !== "qr") throw Object.assign(new Error("not ready"), { status: 503, code: "NOT_READY" });
  const code = await sock.requestPairingCode(num);
  return String(code).match(/.{1,4}/g).join("-");
}

const authed = (req) => {
  const g = Buffer.from(String(req.headers["x-worker-secret"] || "")), e = Buffer.from(SECRET);
  return g.length === e.length && timingSafeEqual(g, e);
};
const readBody = (req) => new Promise((res, rej) => {
  let d = "";
  req.on("data", (c) => { d += c; if (d.length > 10000) { req.destroy(); rej(new Error("too big")); } });
  req.on("end", () => { try { res(d ? JSON.parse(d) : {}); } catch (e) { rej(e); } });
});
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    if (!authed(req)) return json(res, 401, { error: "UNAUTHORIZED" });
    const url = req.url.split("?")[0];
    if (req.method === "GET" && url === "/status") return json(res, 200, status());
    const body = req.method === "POST" ? await readBody(req) : {};

    if (req.method === "POST" && url === "/link/qr") {
      if (state !== "connected") { await start(); await waitFor(() => state === "qr" || state === "connected"); }
      return json(res, 200, status());
    }
    if (req.method === "POST" && url === "/link/code") {
      const num = String(body.phone || "").replace(/\D/g, "");
      if (num.length < 8 || num.length > 15) return json(res, 400, { error: "INVALID_PHONE" });
      try { return json(res, 200, { code: await pairingCode(num) }); }
      catch (e) { return json(res, e.status || 500, { error: e.code || "PAIRING_FAILED" }); }
    }
    if (req.method === "POST" && url === "/send") {
      if (state !== "connected" || !sock) return json(res, 503, { error: "NOT_LINKED" });
      const now = Date.now();
      while (sentAt.length && now - sentAt[0] > 60000) sentAt.shift();
      if (sentAt.length >= MAX_PER_MIN) return json(res, 429, { error: "RATE_LIMITED" });
      const num = String(body.to || "").replace(/\D/g, "");
      const text = String(body.text || "").slice(0, 500);
      if (num.length < 8 || num.length > 15 || !text) return json(res, 400, { error: "INVALID_REQUEST" });
      const [r] = (await sock.onWhatsApp(num)) || [];
      if (!r?.exists) return json(res, 404, { error: "NOT_ON_WHATSAPP" });
      sentAt.push(now);
      const m = await sock.sendMessage(r.jid, { text }); // message text is never logged
      return json(res, 200, { messageId: m?.key?.id });
    }
    if (req.method === "POST" && url === "/logout") {
      try { await sock?.logout(); } catch {}
      sock = null; state = "disconnected"; qr = null; phone = null;
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      return json(res, 200, status());
    }
    json(res, 404, { error: "NOT_FOUND" });
  } catch (e) { console.error("request failed:", e.message); json(res, 500, { error: "WORKER_ERROR" }); }
}).listen(PORT, () => console.log(`CWP WhatsApp worker listening on :${PORT}`));

if (fs.existsSync(`${AUTH_DIR}/creds.json`)) start();
