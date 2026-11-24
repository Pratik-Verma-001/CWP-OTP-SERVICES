"use client";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { useApi } from "@/lib/client/api";
import { Badge, Btn, Card, Loading, PageHead } from "@/components/ui";

const LABELS: Record<string, string> = { email_otp: "Email OTP", whatsapp_otp: "WhatsApp OTP", api_keys: "API keys", project_smtp: "Own email sender", test_otp: "Test OTP", csv_export: "CSV export" };

export default function Settings() {
  const router = useRouter();
  const { data } = useApi<any>("/api/admin/me");
  return (
    <div className="space-y-4">
      <PageHead title="Account" sub="Your profile, plan limits and enabled features." />
      {!data ? <Loading /> : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Name</span><span>{data.name || "-"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-400">Email</span><span className="truncate">{data.email}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">Role</span><Badge s={data.role} /></div>
            <div className="flex items-center justify-between"><span className="text-slate-400">Status</span><Badge s={data.status} /></div>
            <Btn variant="ghost" className="mt-2" onClick={async () => { await signOut(auth); router.replace("/login"); }}>Sign out</Btn>
          </Card>
          <Card className="space-y-2 text-sm">
            <div className="font-medium">Limits</div>
            {data.role === "user" ? (
              <>
                <div className="flex justify-between"><span className="text-slate-400">Projects</span><span>{data.limits.maxProjects}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Keys per project</span><span>{data.limits.maxKeysPerProject}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">OTPs per day</span><span>{data.limits.dailyOtpLimit}</span></div>
              </>) : <div className="text-slate-400">No limits for administrators.</div>}
          </Card>
          <Card className="space-y-2 md:col-span-2">
            <div className="text-sm font-medium">Features</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(data.features).map(([k, on]) => (
                <div key={k} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><span>{LABELS[k] ?? k}</span><Badge s={on ? "active" : "disabled"} /></div>))}
            </div>
          </Card>
        </div>)}
    </div>
  );
}
