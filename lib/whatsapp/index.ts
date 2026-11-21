import { loadStored } from "@/lib/providers/config";
import type { Result } from "@/lib/smtp";

export type WaConfig = {
  phoneNumberId: string; businessAccountId?: string; accessToken: string;
  apiVersion: string; templateName: string; templateLanguage: string;
};

export async function getWaConfig(): Promise<WaConfig | null> {
  const s = await loadStored("whatsapp");
  if (s) {
    if (!s.enabled) return null;
    const c = s.settings, t = s.secrets.accessToken;
    if (!c.phoneNumberId || !t || !c.templateName) return null;
    return { phoneNumberId: c.phoneNumberId, businessAccountId: c.businessAccountId || undefined, accessToken: t,
      apiVersion: c.apiVersion || "v21.0", templateName: c.templateName, templateLanguage: c.templateLanguage || "en_US" };
  }
  const e = process.env;
  if (!e.WHATSAPP_ACCESS_TOKEN || !e.WHATSAPP_PHONE_NUMBER_ID || !e.WHATSAPP_TEMPLATE_NAME) return null;
  return { phoneNumberId: e.WHATSAPP_PHONE_NUMBER_ID, accessToken: e.WHATSAPP_ACCESS_TOKEN,
    apiVersion: e.WHATSAPP_API_VERSION || "v21.0", templateName: e.WHATSAPP_TEMPLATE_NAME,
    templateLanguage: e.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" };
}

const NOT_CONFIGURED = { ok: false as const, code: "PROVIDER_NOT_CONFIGURED", message: "WhatsApp provider is not configured." };

function mapGraphError(status: number, body: any): { code: string; message: string } {
  const c = body?.error?.code;
  if (status === 401 || c === 190) return { code: "WHATSAPP_AUTH_FAILED", message: "WhatsApp access token is invalid or expired." };
  if (c === 131030) return { code: "WHATSAPP_RECIPIENT_NOT_ALLOWED", message: "Recipient is not allowed for this account." };
  if (c === 132001 || c === 132000) return { code: "WHATSAPP_TEMPLATE_ERROR", message: "Template not found or parameters do not match." };
  if (status === 429 || c === 130429 || c === 131056) return { code: "WHATSAPP_RATE_LIMITED", message: "WhatsApp rate limit reached." };
  return { code: "WHATSAPP_SEND_FAILED", message: "WhatsApp delivery failed." };
}

// Official Cloud API, approved "authentication" template with a copy-code button.
export async function sendWhatsAppOtp(to: string, code: string): Promise<Result> {
  const c = await getWaConfig();
  if (!c) return NOT_CONFIGURED;
  try {
    const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "template",
        template: {
          name: c.templateName, language: { code: c.templateLanguage },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, ...mapGraphError(res.status, body) };
    return { ok: true, messageId: body?.messages?.[0]?.id };
  } catch {
    return { ok: false, code: "WHATSAPP_CONNECTION_FAILED", message: "Could not reach the WhatsApp API." };
  }
}

// Config check: confirms token + phone number ID work, without sending any message.
export async function verifyWhatsApp(c: WaConfig): Promise<Result> {
  try {
    const res = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}?fields=verified_name`, {
      headers: { Authorization: `Bearer ${c.accessToken}` }, signal: AbortSignal.timeout(10000),
    });
    const body: any = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, ...mapGraphError(res.status, body) };
  } catch {
    return { ok: false, code: "WHATSAPP_CONNECTION_FAILED", message: "Could not reach the WhatsApp API." };
  }
}
