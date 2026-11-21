"use client";
import { Card, CopyBtn } from "@/components/ui";

const Code = ({ t }: { t: string }) => (
  <div className="relative"><div className="absolute right-2 top-2"><CopyBtn text={t} /></div>
    <pre className="overflow-x-auto rounded-lg bg-navy-900 p-3 pr-16 text-xs">{t}</pre></div>
);
const BASE = "https://YOUR-APP.vercel.app";

export default function Docs() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">API Documentation</h1>
      <Card className="space-y-2 text-sm"><h2 className="font-medium">Introduction & authentication</h2>
        <p className="text-slate-300">Call the API from your <b>server</b>, never from browser JavaScript. Send your project key in the <code>x-api-key</code> header. The OTP code is never returned by the API; it is delivered only to the recipient.</p></Card>
      <Card className="space-y-2"><h2 className="text-sm font-medium">POST /api/v1/otp/send</h2>
        <Code t={`curl -X POST ${BASE}/api/v1/otp/send \\
  -H "x-api-key: cwp_live_xxx" -H "Content-Type: application/json" \\
  -d '{"channel":"email","recipient":"user@example.com","project":"CWP-Pay"}'`} />
        <Code t={`// WhatsApp: "channel":"whatsapp","recipient":"+919876543210"
// Response
{ "success": true, "requestId": "uuid", "expiresIn": 300, "message": "OTP request accepted" }`} /></Card>
      <Card className="space-y-2"><h2 className="text-sm font-medium">POST /api/v1/otp/verify</h2>
        <Code t={`curl -X POST ${BASE}/api/v1/otp/verify \\
  -H "x-api-key: cwp_live_xxx" -H "Content-Type: application/json" \\
  -d '{"requestId":"uuid","code":"123456"}'`} />
        <Code t={`{ "success": true, "verified": true }
// Failure (400)
{ "success": false, "verified": false, "error": { "code": "INVALID_OTP", "message": "Verification failed" } }`} /></Card>
      <Card className="space-y-2"><h2 className="text-sm font-medium">GET /api/v1/usage · GET /api/v1/health</h2>
        <Code t={`curl ${BASE}/api/v1/usage -H "x-api-key: cwp_live_xxx"
curl ${BASE}/api/v1/health`} /></Card>
      <Card className="space-y-2"><h2 className="text-sm font-medium">JavaScript (Node.js)</h2>
        <Code t={`const res = await fetch("${BASE}/api/v1/otp/send", {
  method: "POST",
  headers: { "x-api-key": process.env.CWP_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ channel: "email", recipient: "user@example.com", project: "CWP-Pay" }),
});
const { requestId } = await res.json();`} /></Card>
      <Card className="space-y-2"><h2 className="text-sm font-medium">PHP</h2>
        <Code t={`$ch = curl_init("${BASE}/api/v1/otp/send");
curl_setopt_array($ch, [
  CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["x-api-key: " . getenv("CWP_API_KEY"), "Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode(["channel" => "email", "recipient" => "user@example.com", "project" => "CWP-Pay"]),
]);
$data = json_decode(curl_exec($ch), true);`} /></Card>
      <Card className="space-y-2 text-sm"><h2 className="font-medium">Error codes</h2>
        <ul className="space-y-1 text-slate-300">
          {[["INVALID_API_KEY", "401", "Missing, wrong, disabled or revoked key"], ["PROJECT_PAUSED", "403", "Project is paused"], ["PROJECT_MISMATCH", "403", "Key does not belong to the project"],
            ["ORIGIN_NOT_ALLOWED", "403", "Origin not in allowed origins"], ["INVALID_REQUEST", "400", "Bad channel, recipient or body"], ["INVALID_OTP", "400", "Wrong, expired, used or locked code"],
            ["RESEND_COOLDOWN", "429", "Wait 60s before requesting again"], ["RATE_LIMITED", "429", "Recipient, IP or key limit reached"],
            ["PROVIDER_NOT_CONFIGURED", "503", "Email or WhatsApp provider not set up"], ["SMTP_* / WHATSAPP_*", "502/503", "Provider delivery failure"]].map(([c, s, d]) =>
            <li key={c}><code>{c}</code> <span className="text-slate-500">({s})</span> {d}</li>)}</ul></Card>
      <Card className="space-y-1 text-sm"><h2 className="font-medium">Rate limits</h2>
        <p className="text-slate-300">60s cooldown per recipient · 5 codes per recipient per hour · 20 per IP per hour · 60 per API key per minute · 5 verify attempts per code · codes expire after 5 minutes.</p></Card>
    </div>
  );
}
