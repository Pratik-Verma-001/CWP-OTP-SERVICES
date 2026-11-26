"use client";
import { useState, type ReactNode } from "react";
import { CopyBtn } from "@/components/ui";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://cwp-otp-service.vercel.app";

function Code({ t }: { t: string }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10"><CopyBtn text={t} /></div>
      <pre className="overflow-x-auto rounded-xl bg-black/35 p-3 pr-16 text-xs leading-relaxed">{t}</pre>
    </div>
  );
}
function Tabs({ items }: { items: { label: string; code: string }[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">{items.map((x, n) => (
        <button key={x.label} onClick={() => setI(n)} className={`rounded-lg px-3 py-1.5 text-xs transition ${i === n ? "bg-gradient-to-r from-a1 to-a2 text-white" : "border border-white/10 bg-white/5 text-slate-300"}`}>{x.label}</button>))}</div>
      <Code t={items[i].code} />
    </div>
  );
}
const Sec = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="glass scroll-mt-4 space-y-4 rounded-2xl p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{children}</section>
);
const H3 = ({ children, id }: { children: ReactNode; id?: string }) => <h3 id={id} className="scroll-mt-4 pt-1 text-sm font-semibold text-slate-100">{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="text-sm leading-relaxed text-slate-300">{children}</p>;
const Note = ({ kind = "info", children }: { kind?: "info" | "warn"; children: ReactNode }) => (
  <div className={`rounded-xl border px-3 py-2.5 text-sm ${kind === "warn" ? "border-amber-400/25 bg-amber-400/10 text-amber-200" : "border-sky-400/20 bg-sky-400/10 text-sky-100"}`}>{children}</div>
);
const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="space-y-3">{items.map((x, i) => (
    <li key={i} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-a1 to-a2 text-xs font-semibold text-white">{i + 1}</span>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-300">{x}</div></li>))}</ol>
);
const Table = ({ head, rows }: { head: string[]; rows: ReactNode[][] }) => (
  <div className="overflow-x-auto rounded-xl border border-white/10">
    <table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-white/5 text-xs text-slate-400"><tr>{head.map((h) => <th key={h} className="p-2.5 font-medium">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-white/10 align-top">{r.map((c, j) => <td key={j} className="p-2.5 text-slate-300">{c}</td>)}</tr>)}</tbody></table>
  </div>
);
const C = ({ children }: { children: ReactNode }) => <code className="rounded bg-white/10 px-1 py-0.5 text-[12px]">{children}</code>;

const TOC: [string, string][] = [
  ["overview", "Overview"], ["quickstart", "Quick start"], ["account", "Accounts and approval"], ["project", "Projects and API keys"], ["email", "Email setup"],
  ["api", "API reference"], ["integrate", "Add OTP to your website"], ["whatsapp", "Connect WhatsApp"], ["whatsapp-troubleshooting", "WhatsApp problems"],
  ["admin", "Administrator guide"], ["troubleshooting", "Troubleshooting"], ["limits", "Limits and security"],
];

const SEND_OK = `{ "success": true, "requestId": "3f2c9a52-0b1e-4c1a-9d57-0d4f2a1b3c4d", "expiresIn": 300, "message": "OTP request accepted" }`;
const node = `// server.js   (Node 18+, run: npm i express)
import express from "express";

const app = express();
app.use(express.json());

const CWP_URL = "${BASE}/api/v1/otp";
const CWP_KEY = process.env.CWP_API_KEY;   // cwp_live_...  keep it on the server only
const PROJECT = "My Website";               // the exact project name from your dashboard

async function cwp(path, body) {
  const res = await fetch(CWP_URL + "/" + path, {
    method: "POST",
    headers: { "x-api-key": CWP_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// 1) the visitor types their email (or +country-code phone) and your page calls this
app.post("/api/send-otp", async (req, res) => {
  const { channel, recipient } = req.body;            // channel: "email" or "whatsapp"
  const out = await cwp("send", { channel, recipient, project: PROJECT });
  res.status(out.status).json(out.data);              // on success it contains requestId
});

// 2) the visitor types the code and your page calls this
app.post("/api/verify-otp", async (req, res) => {
  const { requestId, code } = req.body;
  const out = await cwp("verify", { requestId, code });
  if (out.data.verified) {
    // success: mark the email/phone as verified or start the login session in YOUR database
  }
  res.status(out.status).json(out.data);
});

app.listen(3000);`;
const python = `# pip install flask requests
import os, requests
from flask import Flask, request, jsonify

app = Flask(__name__)
CWP = "${BASE}/api/v1/otp"
HEADERS = {"x-api-key": os.environ["CWP_API_KEY"], "Content-Type": "application/json"}
PROJECT = "My Website"

@app.post("/api/send-otp")
def send_otp():
    body = {"channel": request.json.get("channel", "email"), "recipient": request.json["recipient"], "project": PROJECT}
    r = requests.post(CWP + "/send", json=body, headers=HEADERS, timeout=30)
    return jsonify(r.json()), r.status_code

@app.post("/api/verify-otp")
def verify_otp():
    body = {"requestId": request.json["requestId"], "code": request.json["code"]}
    r = requests.post(CWP + "/verify", json=body, headers=HEADERS, timeout=30)
    data = r.json()
    if data.get("verified"):
        pass  # mark the user as verified in your database
    return jsonify(data), r.status_code`;
const php = `<?php
// otp.php  (PHP 7.4+ with cURL; put CWP_API_KEY in your server environment)
const CWP_URL = "${BASE}/api/v1/otp/";

function cwp($path, $body) {
    $ch = curl_init(CWP_URL . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ["x-api-key: " . getenv("CWP_API_KEY"), "Content-Type: application/json"],
        CURLOPT_POSTFIELDS => json_encode($body),
    ]);
    $data = json_decode(curl_exec($ch), true);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, $data];
}

$in = json_decode(file_get_contents("php://input"), true);
if (($_GET["action"] ?? "") === "send") {
    [$status, $data] = cwp("send", ["channel" => $in["channel"] ?? "email", "recipient" => $in["recipient"], "project" => "My Website"]);
} else {
    [$status, $data] = cwp("verify", ["requestId" => $in["requestId"], "code" => $in["code"]]);
    if (!empty($data["verified"])) { /* mark verified in your database / start the session */ }
}
header("Content-Type: application/json");
http_response_code($status);
echo json_encode($data);`;
const curl = `# Send
curl -X POST ${BASE}/api/v1/otp/send \\
  -H "x-api-key: cwp_live_xxxxxxxx" -H "Content-Type: application/json" \\
  -d '{"channel":"email","recipient":"user@example.com","project":"My Website"}'

# Verify (use the requestId returned above and the code from the email)
curl -X POST ${BASE}/api/v1/otp/verify \\
  -H "x-api-key: cwp_live_xxxxxxxx" -H "Content-Type: application/json" \\
  -d '{"requestId":"3f2c9a52-0b1e-4c1a-9d57-0d4f2a1b3c4d","code":"123456"}'

# Usage and health
curl ${BASE}/api/v1/usage -H "x-api-key: cwp_live_xxxxxxxx"
curl ${BASE}/api/v1/health`;
const html = `<input id="email" type="email" placeholder="you@example.com">
<button onclick="sendOtp()">Send code</button>

<div id="step2" hidden>
  <input id="code" inputmode="numeric" maxlength="6" placeholder="6-digit code">
  <button onclick="verifyOtp()">Verify</button>
</div>
<p id="msg"></p>

<script>
let requestId = null;
const say = (t) => (document.getElementById("msg").textContent = t);

async function sendOtp() {
  const r = await fetch("/api/send-otp", {            // YOUR backend route, not ours
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "email", recipient: document.getElementById("email").value }),
  });
  const d = await r.json();
  if (d.success) { requestId = d.requestId; document.getElementById("step2").hidden = false; say("Code sent. Check your inbox."); }
  else say(d.error ? d.error.message : "Could not send the code");
}

async function verifyOtp() {
  const r = await fetch("/api/verify-otp", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, code: document.getElementById("code").value }),
  });
  const d = await r.json();
  say(d.verified ? "Verified!" : "Wrong or expired code");
}
</script>`;
const wa = `{ "channel": "whatsapp", "recipient": "+919876543210", "project": "My Website" }`;

export default function DocsView({ inShell = false }: { inShell?: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className={`hidden lg:block ${inShell ? "" : ""}`}>
        <nav className="glass sticky top-0 max-h-[calc(100vh-2rem)] space-y-0.5 overflow-y-auto rounded-2xl p-3">
          <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">On this page</div>
          {TOC.map(([id, l]) => <a key={id} href={`#${id}`} className="block rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white">{l}</a>)}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <details className="glass rounded-2xl p-3 lg:hidden"><summary className="cursor-pointer text-sm font-medium">On this page</summary>
          <div className="mt-2 grid grid-cols-2 gap-1">{TOC.map(([id, l]) => <a key={id} href={`#${id}`} className="rounded-lg bg-white/5 px-2 py-1.5 text-xs text-slate-300">{l}</a>)}</div></details>

        <Sec id="overview" title="Overview">
          <P>CWP OTP Services sends one-time passwords (OTPs) by <b>email</b> and <b>WhatsApp</b> and checks them for you. You keep control: emails go out from <b>your own mailbox</b>, and every website you connect gets its own API key.</P>
          <Steps items={[
            <>Your visitor enters their email or phone number on <b>your website</b>.</>,
            <>Your website&apos;s <b>server</b> calls our <C>/otp/send</C> endpoint with your API key. We create a code, store only a hash of it, and deliver it.</>,
            <>We answer with a <C>requestId</C>. Your website shows a box for the code.</>,
            <>The visitor types the code. Your server calls <C>/otp/verify</C> with the <C>requestId</C> and the code.</>,
            <>We answer <C>verified: true</C> or <C>false</C>. A code works once and expires after 5 minutes.</>,
          ]} />
          <P>Base URL for every request: <C>{BASE}</C></P>
          <Note kind="warn">Call the API from your <b>server</b> only. Never put the API key in HTML, JavaScript that runs in the browser, or a mobile app: anyone could copy it.</Note>
        </Sec>

        <Sec id="quickstart" title="Quick start">
          <Steps items={[
            <>Create an account (<C>/register</C>), verify your email, and wait for approval if the platform requires it.</>,
            <><b>Projects</b>: create a project for your website. The name is used in API calls.</>,
            <><b>Email</b>: choose the project, enter your mailbox settings and app password, press <b>Test connection</b> and <b>Send test email</b>, tick <b>Enabled</b> and Save.</>,
            <><b>API Keys</b>: create a key for the project and copy it immediately (it is shown only once).</>,
            <><b>Test OTP</b>: send a real code to yourself and verify it. If that works, copy the code from the examples below into your website.</>,
          ]} />
        </Sec>

        <Sec id="account" title="Accounts and approval">
          <Table head={["Message", "What it means", "What to do"]} rows={[
            ["Email is not verified", "Firebase sent you a verification link", "Open the link in the email (check spam), then press \"I verified, check again\"."],
            ["Waiting for approval", "The administrator reviews new accounts", "Wait to be approved, or contact the administrator."],
            ["Suspended", "The administrator paused your account", "Contact the administrator."],
            ["Registration is closed", "Only the administrator can add users", "Ask the administrator to add your email."],
          ]} />
          <P>Your dashboard (<C>/dashboard</C>) is private to your account. The administration area is a separate site section with its own login and is not available to users.</P>
        </Sec>

        <Sec id="project" title="Projects and API keys">
          <Steps items={[
            <>Open <b>Projects</b> and create a project. Add your website&apos;s address as an <b>allowed origin</b> only if you ever call the API from a browser (normally leave it empty).</>,
            <>Open <b>API Keys</b>, choose the project, give the key a name (for example &quot;Production&quot;) and press Create.</>,
            <>Copy the key now. It looks like <C>cwp_live_AbC...</C>. We store only a hash, so it cannot be shown again. If you lose it, rotate it.</>,
            <>Save it as an environment variable on your server, for example <C>CWP_API_KEY</C>.</>,
          ]} />
          <Table head={["Action", "Effect"]} rows={[
            ["Disable / Enable", "Temporarily stops or resumes the key."], ["Rotate", "Creates a new key and permanently revokes the old one immediately."],
            ["Revoke", "Permanently kills the key."], ["Pause project", "All keys of the project stop working until you activate it again."],
          ]} />
        </Sec>

        <Sec id="email" title="Email setup">
          <P>OTP emails are sent through an SMTP mailbox. A <b>project sender</b> (yours) is used first; if a project has none, the platform&apos;s default sender is used.</P>
          <H3>Gmail (most common)</H3>
          <Steps items={[
            <>Open your Google Account &gt; <b>Security</b> and turn on <b>2-Step Verification</b> (required for app passwords).</>,
            <>In Security, open <b>App passwords</b>, create one named &quot;CWP OTP&quot; and copy the 16 letters. Use <b>this</b>, not your normal Gmail password. Spaces are removed automatically.</>,
            <>In the dashboard open <b>Email</b>, choose your project, press the <b>Gmail</b> quick-fill button (host <C>smtp.gmail.com</C>, port <C>465</C>, SSL).</>,
            <>Username = your full Gmail address. Sender email = the same address. Sender name = what your users should see (for example &quot;My Website&quot;).</>,
            <>Paste the app password, press <b>Save</b>, then <b>Test connection</b> (login check) and <b>Send test email</b> (a real email to the address you type).</>,
            <>Tick <b>Enabled</b> and Save again. From now on OTP emails for that project use your mailbox.</>,
          ]} />
          <H3>Other providers</H3>
          <Table head={["Provider", "Host", "Port", "Encryption"]} rows={[
            ["Gmail / Google Workspace", "smtp.gmail.com", "465", "SSL"], ["Outlook / Microsoft 365", "smtp.office365.com", "587", "STARTTLS"],
            ["Zoho Mail (India)", "smtp.zoho.in", "465", "SSL"], ["Yahoo", "smtp.mail.yahoo.com", "465", "SSL"],
            ["Your own domain", "ask your hosting provider", "465 or 587", "SSL / STARTTLS"],
          ]} />
          <Note>Free mailboxes limit how many emails they send per day and may block accounts that send a lot. For high volume use a business mailbox or a transactional SMTP service. The password is stored encrypted and is never shown again; leave the field empty to keep it.</Note>
        </Sec>

        <Sec id="api" title="API reference">
          <H3>Authentication</H3>
          <P>Send your key in the <C>x-api-key</C> header on every request. Bodies are JSON (<C>Content-Type: application/json</C>).</P>
          <H3>POST /api/v1/otp/send</H3>
          <Table head={["Field", "Type", "Description"]} rows={[
            [<C key="a">channel</C>, "string", "\"email\" or \"whatsapp\""], [<C key="b">recipient</C>, "string", "Email address, or WhatsApp number in international format with +, e.g. +919876543210"],
            [<C key="c">project</C>, "string", "Exact name of the project that owns the API key (not case-sensitive)"],
          ]} />
          <Code t={`${SEND_OK}`} />
          <P>The code itself is <b>never</b> returned. It goes only to the recipient.</P>
          <H3>POST /api/v1/otp/verify</H3>
          <Table head={["Field", "Type", "Description"]} rows={[[<C key="a">requestId</C>, "string", "The requestId from /send"], [<C key="b">code</C>, "string", "The digits the user typed"]]} />
          <Code t={`// success (HTTP 200)\n{ "success": true, "verified": true }\n\n// failure (HTTP 400): wrong, expired, already used, or too many attempts\n{ "success": false, "verified": false, "error": { "code": "INVALID_OTP", "message": "Verification failed" } }`} />
          <H3>GET /api/v1/usage and GET /api/v1/health</H3>
          <P><C>/usage</C> (needs the key) returns totals for the key&apos;s project: requests, today, email, WhatsApp, successful and failed verifications. <C>/health</C> needs no key and returns <C>{`{"status":"ok"}`}</C>.</P>
          <H3>Error codes</H3>
          <Table head={["HTTP", "Code", "Meaning and fix"]} rows={[
            ["401", "INVALID_API_KEY", "Missing, wrong, disabled or revoked key."], ["400", "INVALID_REQUEST", "Bad channel, email, phone format (use +countrycode) or body."],
            ["403", "PROJECT_MISMATCH", "The project name does not belong to this key."], ["403", "PROJECT_PAUSED", "Activate the project in Projects."],
            ["403", "ORIGIN_NOT_ALLOWED", "Browser call from an origin not listed in the project."], ["403", "FEATURE_DISABLED / ACCOUNT_SUSPENDED", "The administrator turned the feature off or suspended the account."],
            ["429", "RESEND_COOLDOWN", "Same recipient asked again within 60 seconds."], ["429", "RATE_LIMITED / DAILY_LIMIT", "A rate limit or your daily quota was reached."],
            ["400", "INVALID_OTP", "Wrong, expired (5 min), already used, or 5 wrong attempts."],
            ["503", "PROVIDER_NOT_CONFIGURED", "No enabled email sender / WhatsApp link. Finish the setup."], ["502 / 503", "SMTP_* / WHATSAPP_*", "Delivery problem. See Troubleshooting."], ["503", "MAINTENANCE", "The platform is paused by the administrator."],
          ]} />
        </Sec>

        <Sec id="integrate" title="Add OTP to your website">
          <P>You need two small routes on <b>your server</b> (one to send, one to verify) and a small form on your page. The page talks to <b>your</b> routes; your routes talk to ours with the API key.</P>
          <H3>1. Your server (choose your language)</H3>
          <Tabs items={[{ label: "Node.js", code: node }, { label: "Python (Flask)", code: python }, { label: "PHP", code: php }, { label: "cURL", code: curl }]} />
          <H3>2. Your web page</H3>
          <Code t={html} />
          <H3>WhatsApp instead of email</H3>
          <P>Only the body of <C>/otp/send</C> changes. Everything else is identical:</P>
          <Code t={wa} />
          <H3>Checklist before going live</H3>
          <Steps items={[
            <>The API key is in a server environment variable, not in your code or front-end.</>,
            <>After <C>verified: true</C>, your server (not the browser) marks the user as verified.</>,
            <>Show a 60-second &quot;resend&quot; timer to match the cooldown, and handle every error code above with a friendly message.</>,
            <>Test with a real address using the <b>Test OTP</b> page first.</>,
          ]} />
        </Sec>

        <Sec id="whatsapp" title="Connect WhatsApp">
          <P>WhatsApp OTPs are sent from <b>one WhatsApp number linked to the platform</b>, like WhatsApp Web. A small program called the <b>worker</b> keeps that link alive. It connects out to this app, so you do not need a public URL or port forwarding. This is set up by the platform administrator under <b>Administration &gt; WhatsApp</b>. Everyone else only uses <C>channel: &quot;whatsapp&quot;</C>.</P>
          <Note kind="warn">This uses the unofficial linked-device method. WhatsApp may restrict or ban numbers used for automated messages. Use a spare number, never your personal one, and keep volume low. The worker computer or phone must stay on and online.</Note>
          <H3>What you need</H3>
          <Table head={["Item", "Details"]} rows={[
            ["A spare WhatsApp number", "On a phone that can scan a QR code (this can be a different phone from the worker)."],
            ["A machine that stays on", "Android phone with Termux, a PC, or a small server. Node.js 18 or newer."],
            ["The worker folder", "The worker/ folder from the project source code."],
          ]} />
          <H3>Setup, step by step</H3>
          <Steps items={[
            <>Sign in at <C>/administration</C> with the administrator credentials and open <b>WhatsApp</b>.</>,
            <>Press <b>Create token</b>. Keep the token private.</>,
            <>On the worker machine, create <C>worker/.env</C> with two lines: <C>APP_URL={BASE}</C> and <C>WORKER_TOKEN=your-token</C>. The page shows these lines ready to copy.</>,
            <>Install and start it. <b>Termux:</b> <C>pkg install nodejs git</C>, then in the worker folder <C>npm install</C>, <C>termux-wake-lock</C>, and <C>set -a; . ./.env; set +a; node index.js</C>. <b>PC/server:</b> <C>npm install</C> then the same start line (use <C>pm2</C> to keep it running).</>,
            <>Within a few seconds the dashboard shows <b>Worker running</b>. If not, see the problems list below.</>,
            <>Press <b>Generate QR code</b>. A QR appears within about 20 seconds.</>,
            <>On the spare number&apos;s phone: open WhatsApp &gt; <b>Settings</b> (or the 3 dots) &gt; <b>Linked devices</b> &gt; <b>Link a device</b> and scan the QR on screen.</>,
            <>When it says <b>WhatsApp is linked</b>, send a <b>test message</b> to your own number. Make sure <b>Use WhatsApp for OTPs</b> is on.</>,
          ]} />
          <H3>No camera? Use the pairing code</H3>
          <P>Enter the spare number with country code (for example <C>919876543210</C>) under <b>Option B</b> and press <b>Get pairing code</b>. On the phone: Linked devices &gt; Link a device &gt; <b>Link with phone number instead</b> and type the 8-character code.</P>
          <H3>QR code behaviour</H3>
          <Table head={["What you see", "Meaning"]} rows={[
            ["Grey pulsing box, \"Connecting to WhatsApp\"", "The worker is contacting WhatsApp. Wait up to 20 seconds."],
            ["QR with \"Code is Ns old\"", "It is valid. It refreshes by itself about every 20 seconds, so scan the one on screen."],
            ["\"This code may have expired\"", "Press Regenerate QR to create a new one."],
            ["Red message under the title", "The worker reported a problem (for example it was logged out). Follow the message."],
            ["\"WhatsApp is linked\"", "Done. The number is ready to send OTPs."],
          ]} />
          <H3>Keeping it running</H3>
          <Steps items={[
            <><b>Termux:</b> run <C>termux-wake-lock</C>, set Termux battery to &quot;Unrestricted&quot; in Android settings, and keep the session open.</>,
            <><b>Server/PC:</b> <C>npm i -g pm2 &amp;&amp; pm2 start index.js --name cwp-wa &amp;&amp; pm2 save</C> so it restarts after a reboot.</>,
            <>The linked session is saved in <C>worker/auth/</C>. Back it up and never commit it. If you delete it you must scan again.</>,
          ]} />
        </Sec>

        <Sec id="whatsapp-troubleshooting" title="WhatsApp problems">
          <Table head={["Problem", "Likely cause", "Fix"]} rows={[
            ["Dashboard says the worker is offline", "Worker not running, no internet, or wrong .env", "Start it. In its terminal you should see \"Connected to the app\". If you see \"cannot reach the app\", check APP_URL (no trailing path)."],
            ["Worker log: \"401: token rejected\"", "The token was rotated or copied wrongly", "Press Show token in the dashboard and paste it into worker/.env, then restart the worker."],
            ["Worker online but no QR appears", "It is still connecting, or WhatsApp refused the connection", "Wait 20 s, press Regenerate QR. Look at the worker terminal for \"connection closed: 405\": run npm i @whiskeysockets/baileys@latest and restart."],
            ["QR shows but WhatsApp will not scan it", "QR expired or the screen is too small/dim", "Scan the newest QR quickly, raise brightness, zoom the page, or use the pairing code instead."],
            ["\"Logged out\" after being linked", "The device was removed in WhatsApp > Linked devices", "Generate a new QR and link again."],
            ["Linked, but OTPs fail with WHATSAPP_NOT_LINKED / WORKER_UNREACHABLE", "Worker stopped or lost internet", "Restart the worker; the number stays linked."],
            ["WHATSAPP_RECIPIENT_NOT_FOUND", "The recipient number is not on WhatsApp or has a typo", "Use international format with +, e.g. +919876543210."],
            ["WHATSAPP_TIMEOUT", "Worker is slow or busy", "Retry. Keep the worker on a stable connection."],
            ["WHATSAPP_RATE_LIMITED", "More than 15 messages in a minute from the worker", "Slow down. This protects the number from bans."],
            ["npm install fails on Termux", "git or Node missing", "Run pkg install git nodejs, then npm install again."],
          ]} />
        </Sec>

        <Sec id="admin" title="Administrator guide">
          <P>There is exactly <b>one</b> platform administrator. The administrator signs in at <C>/administration/login</C> with a dedicated username and password that are <b>not</b> a user account. Regular users cannot open the administration area, and every administration API call is checked on the server.</P>
          <Steps items={[
            <>Set three environment variables on your host: <C>ADMIN_USERNAME</C>, <C>ADMIN_PASSWORD_HASH</C> and <C>ADMIN_SESSION_SECRET</C>.</>,
            <>Create the hash on your computer: <C>node scripts/make-admin-hash.mjs &quot;your long password&quot;</C>. It prints both values.</>,
            <>Redeploy, open <C>/administration</C> and sign in. You can change the password later under <b>Settings</b>.</>,
          ]} />
          <Table head={["Section", "What it does"]} rows={[
            ["Users", "Approve, suspend, edit or delete users; open a user to see usage per feature, projects and activity."],
            ["Features", "Switch features on or off for everyone, choose what new users get, add your own flags."],
            ["WhatsApp", "Create the worker token, link the number, send a test message."],
            ["Email", "Set the default sender used by projects without their own."],
            ["Settings", "Registration mode (open / approval / closed), default limits, announcement banner, maintenance mode, admin password."],
            ["Audit log", "Every administrative action."],
          ]} />
          <Note>Sign-in is limited to 5 wrong attempts per 15 minutes per network, sessions last 8 hours, and changing the password signs out every other session.</Note>
        </Sec>

        <Sec id="troubleshooting" title="Troubleshooting">
          <Table head={["Symptom", "Cause", "Fix"]} rows={[
            ["INVALID_API_KEY", "Wrong, disabled or revoked key; extra space; header name wrong", "Create a new key. The header must be exactly x-api-key. Print the first 12 characters on your server to check it is loaded."],
            ["PROJECT_MISMATCH", "The project field differs from the project that owns the key", "Copy the exact project name from Projects."],
            ["PROVIDER_NOT_CONFIGURED (email)", "No enabled sender", "Email page: save the settings, tick Enabled, then Test connection."],
            ["SMTP_AUTH_FAILED", "Wrong username or app password", "Gmail needs 2-Step Verification and an App password. Username is the full address. Create a new app password."],
            ["SMTP_CONNECTION_FAILED", "Wrong host, port or encryption", "Gmail: smtp.gmail.com, 465, SSL. Try 587 with STARTTLS if 465 is blocked."],
            ["Email not received", "Spam folder, wrong address, provider limit", "Check spam, send a test email from the Email page, and look at OTP Logs for the delivery status."],
            ["RESEND_COOLDOWN", "Same recipient within 60 seconds", "Show a 60 s timer before allowing resend."],
            ["INVALID_OTP for a correct code", "Code expired (5 min), used before, or a newer code was requested", "Request a new code and use the latest one."],
            ["ORIGIN_NOT_ALLOWED", "You called the API from a browser", "Move the call to your server, or add the site address to the project's allowed origins."],
            ["Admin login says not configured", "Environment variables missing", "Set the three ADMIN_* variables and redeploy."],
            ["\"Too many failed attempts\"", "5 wrong admin logins", "Wait 15 minutes."],
          ]} />
        </Sec>

        <Sec id="limits" title="Limits and security">
          <Table head={["Rule", "Value"]} rows={[
            ["Code", "6 digits, valid 5 minutes, single use"], ["Wrong attempts per code", "5, then the code is locked"], ["Resend cooldown", "60 seconds per recipient"],
            ["Per recipient", "5 codes per hour"], ["Per IP address", "20 requests per hour"], ["Per API key", "60 sends per minute, 120 verifications per minute"],
            ["Per account", "Daily OTP quota and project/key limits set by the administrator"],
          ]} />
          <Steps items={[
            <>Codes and API keys are stored only as hashes. Mailbox passwords are encrypted. Codes never appear in logs or API responses.</>,
            <>Recipients are masked in logs (for example <C>u***@example.com</C>).</>,
            <>Keep your API key secret and rotate it if it ever leaks.</>,
          ]} />
        </Sec>
      </div>
    </div>
  );
}
