"use client";
import Link from "next/link";
import { useApi } from "@/lib/client/api";
import { useSession } from "@/lib/client/session";
import { Badge, Card, Loading, PageHead } from "@/components/ui";

export default function WhatsAppInfo() {
  const { me } = useSession();
  const { data } = useApi<any>("/api/admin/setup");
  const allowed = me ? me.features.whatsapp_otp !== false : true;
  const admin = me?.role === "owner" || me?.role === "admin";
  return (
    <div className="space-y-4">
      <PageHead title="WhatsApp" sub="WhatsApp OTPs are sent from the platform's linked number." />
      <Card className="space-y-3">
        {!data ? <Loading /> : (
          <>
            <div className="flex items-center justify-between gap-2 text-sm"><span>Platform WhatsApp</span><Badge s={data.whatsapp ? "online" : "offline"} /></div>
            <div className="flex items-center justify-between gap-2 text-sm"><span>Enabled for your account</span><Badge s={allowed ? "active" : "disabled"} /></div>
            <p className="text-xs text-slate-400">Use channel <code>whatsapp</code> with a number in international format (e.g. +919876543210) in your API calls, or try it on the Test OTP page.
              {!allowed && " This feature is turned off for your account. Ask the administrator."}</p>
            {admin && <Link href="/administration/worker" className="inline-block rounded-xl bg-gradient-to-r from-a1 to-a2 px-4 py-2.5 text-sm font-medium text-white">Manage the WhatsApp worker</Link>}
          </>)}
      </Card>
    </div>
  );
}
