"use client";
import { Card } from "@/components/ui";
import SmtpForm from "@/components/providers/SmtpForm";
import WhatsAppCard from "@/components/providers/WhatsAppCard";

export default function Providers() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Providers</h1>
      <Card className="space-y-3"><h2 className="font-medium">Email (SMTP)</h2><SmtpForm scope={{ kind: "global" }} /></Card>
      <WhatsAppCard />
    </div>
  );
}
