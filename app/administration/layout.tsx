"use client";
import { useSession } from "@/lib/client/session";
import PanelShell, { type NavItem } from "@/components/shell/PanelShell";
import Denied from "@/components/shell/Denied";
import { Backdrop, Loading } from "@/components/ui";

const NAV: NavItem[] = [
  { label: "Overview", href: "/administration", icon: "dashboard", group: "Overview", exact: true, dock: true },
  { label: "Users", href: "/administration/users", icon: "users", group: "People", dock: true },
  { label: "Features", href: "/administration/features", icon: "star", group: "People", dock: true },
  { label: "WhatsApp Worker", href: "/administration/worker", icon: "chat", group: "Connections", dock: true },
  { label: "Email", href: "/administration/email", icon: "mail", group: "Connections" },
  { label: "Settings", href: "/administration/settings", icon: "settings", group: "System" },
  { label: "Audit log", href: "/administration/audit", icon: "clipboard", group: "System" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = useSession();
  if (s.state === "loading") return <><Backdrop /><div className="mx-auto max-w-md p-8"><Loading /></div></>;
  if (s.state === "denied" || !s.me) return <Denied why={s.why} />;
  if (s.me.role !== "owner" && s.me.role !== "admin")
    return <Denied title="Administrators only" why="Your account does not have access to the administration panel." back={{ label: "Go to my dashboard", href: "/dashboard" }} />;
  return (
    <PanelShell variant="admin" nav={NAV} me={s.me} switchTo={{ label: "User panel", href: "/dashboard", icon: "back" }}>
      {children}
    </PanelShell>
  );
}
