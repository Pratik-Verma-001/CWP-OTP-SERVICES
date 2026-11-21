"use client";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/client/firebase";
import { useApi } from "@/lib/client/api";
import { Btn, Card, Loading } from "@/components/ui";

export default function Settings() {
  const router = useRouter();
  const { data } = useApi<any>("/api/admin/me");
  return (
    <div className="space-y-4"><h1 className="text-lg font-semibold">Settings</h1>
      <Card className="space-y-2">{!data ? <Loading /> : <>
        <div className="text-sm"><span className="text-slate-400">Email:</span> {data.email}</div>
        <div className="text-sm"><span className="text-slate-400">Role:</span> {data.role}</div></>}
        <p className="text-xs text-slate-500">Admins are controlled by ADMIN_ALLOWLIST on the server. Password changes are done in Firebase Authentication.</p>
        <Btn variant="ghost" onClick={async () => { await signOut(auth); router.replace("/login"); }}>Sign out</Btn></Card></div>
  );
}
