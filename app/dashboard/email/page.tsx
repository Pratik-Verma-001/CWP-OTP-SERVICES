"use client";
import { useEffect, useState } from "react";
import { useApi } from "@/lib/client/api";
import { Card, Empty, Field, inputCls, PageHead } from "@/components/ui";
import SmtpForm from "@/components/providers/SmtpForm";

export default function EmailPage() {
  const { data } = useApi<any>("/api/admin/projects");
  const [projectId, setProjectId] = useState("");
  const projects = data?.projects ?? [];
  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0].id); }, [projects, projectId]);
  return (
    <div className="space-y-4">
      <PageHead title="Email sender" sub="Send your project's OTP emails from your own mailbox." />
      <Card className="space-y-4">
        <p className="text-sm text-slate-400">Add your email and app password for a project. OTP emails for that project then go out from your mailbox with your sender name. Projects without their own sender use the platform default.</p>
        {!projects.length ? <Empty text="Create a project first" /> : (
          <>
            <Field label="Project"><select className={inputCls} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
            {projectId && <SmtpForm key={projectId} scope={{ kind: "project", projectId }} />}
          </>)}
      </Card>
    </div>
  );
}
