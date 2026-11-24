"use client";
import { Card, PageHead } from "@/components/ui";
import SmtpForm from "@/components/providers/SmtpForm";

export default function AdminEmail() {
  return (
    <div className="space-y-4">
      <PageHead title="Platform email sender" sub="Default mailbox used for projects that do not have their own sender." />
      <Card><SmtpForm scope={{ kind: "global" }} /></Card>
    </div>
  );
}
