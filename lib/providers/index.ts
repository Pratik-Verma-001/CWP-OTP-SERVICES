import { sendEmailOtp } from "@/lib/smtp";
import { sendWhatsAppOtp } from "@/lib/whatsapp";

export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; code: string; message: string };

// Real delivery only; a missing provider config is reported, never simulated.
export async function deliver(channel: "email" | "whatsapp", recipient: string, code: string, ttlSeconds: number): Promise<SendResult> {
  return channel === "email" ? sendEmailOtp(recipient, code, ttlSeconds) : sendWhatsAppOtp(recipient, code);
}
