"use client";
import { useSession } from "@/lib/client/session";
import PanelShell, { type NavItem } from "@/components/shell/PanelShell";
import Denied from "@/components/shell/Denied";
import { Backdrop, Loading } from "@/components/ui";

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", group: "Overview", exact: true, dock: true },
  { label: "Projects", href: "/dashboard/projects", icon: "projects", group: "Build", dock: true },
  { label: "API Keys", href: "/dashboard/api-keys", icon: "key", group: "Build", dock: true },
  { label: "Email", href: "/dashboard/email", icon: "mail", group: "Build" },
  { label: "Test OTP", href: "/dashboard/test", icon: "send", group: "Build", dock: true },
  { label: "OTP Logs", href: "/dashboard/logs", icon: "logs", group: "Monitor" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", group: "Monitor" },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: "chat", group: "Help" },
  { label: "API Docs", href: "/dashboard/docs", icon: "docs", group: "Help" },
  { label: "Settings", href: "/dashboard/settings", icon: "settings", group: "Help" },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const s = useSession();
  if (s.state === "loading") return <><Backdrop /><div className="mx-auto max-w-md p-8"><Loading /></div></>;
  if (s.state === "denied" || !s.me) return <Denied why={s.why} />;
  const admin = s.me.role === "owner" || s.me.role === "admin";
  return (
    <PanelShell variant="user" nav={NAV} me={s.me} switchTo={admin ? { label: "Administration", href: "/administration", icon: "shield" } : undefined}>
      {children}
    </PanelShell>
  );
}
