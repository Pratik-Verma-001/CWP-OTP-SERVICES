import DocsView from "@/components/docs/DocsView";
import { PageHead } from "@/components/ui";

export default function DashboardDocs() {
  return (
    <div className="space-y-4">
      <PageHead title="Documentation" sub="Everything you need to set up email, WhatsApp and connect your website." />
      <DocsView inShell />
    </div>
  );
}
