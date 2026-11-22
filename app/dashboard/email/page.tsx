"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/client/api";
import { Card, Empty, Field, inputCls } from "@/components/ui";
import SmtpForm from "@/components/providers/SmtpForm";

export default function EmailPage() {
  const [tab, setTab] = useState<"global" | "project">("global");
  const { data } = useApi<any>("/api/admin/projects");
  const [projectId, setProjectId] = useState("");
  const projects = data?.projects ?? [];
  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0].id); }, [projects, projectId]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Email (SMTP)</h1>
      <Card className="space-y-4">
        <div className="flex w-full rounded-xl border border-white/10 bg-black/20 p-1 text-xs sm:w-fit">
          {([["global", "Default sender"], ["project", "Per-project sender"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-2 transition sm:flex-none ${tab === k ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white" : "text-slate-300"}`}>{l}</button>))}
        </div>
        {tab === "global" ? (
          <>
            <p className="text-sm text-slate-400">Your own mailbox and app password. Used for every project that does not have its own sender.</p>
            <SmtpForm scope={{ kind: "global" }} />
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">Each project (or client) can bring its own email and app password. OTP emails for that project are then sent from that mailbox with its own sender name.</p>
            {!projects.length ? <Empty text="Create a project first" /> : (
              <>
                <Field label="Project"><select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
                {projectId && <SmtpForm key={projectId} scope={{ kind: "project", projectId }} />}
              </>)}
          </>)}
      </Card>
    </div>
  );
}
