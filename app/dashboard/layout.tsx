"use client";
import { useEffect } from "react";
import { useSession } from "@/lib/client/session";
import { prefetchApi } from "@/lib/client/api";
import PanelShell, { type NavItem } from "@/components/shell/PanelShell";
import Denied from "@/components/shell/Denied";
import { Splash } from "@/components/ui";

const NAV: NavItem[] = [
  { label: "Dashboard", short: "Home", href: "/dashboard", icon: "dashboard", group: "Overview", exact: true, dock: true },
  { label: "Projects", href: "/dashboard/projects", icon: "projects", group: "Build", dock: true },
  { label: "API Keys", short: "Keys", href: "/dashboard/api-keys", icon: "key", group: "Build", dock: true },
  { label: "Test OTP", short: "Test", href: "/dashboard/test", icon: "send", group: "Build", dock: true },
  { label: "Email", href: "/dashboard/email", icon: "mail", group: "Build" },
  { label: "OTP Logs", href: "/dashboard/logs", icon: "logs", group: "Monitor" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "analytics", group: "Monitor" },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: "chat", group: "Help" },
  { label: "Documentation", href: "/dashboard/docs", icon: "docs", group: "Help" },
  { label: "Account", href: "/dashboard/settings", icon: "settings", group: "Help" },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const s = useSession();
  useEffect(() => { if (s.state === "ok") prefetchApi(["/api/admin/stats?days=7", "/api/admin/setup", "/api/admin/projects"]); }, [s.state]);
  if (s.state === "loading") return <Splash />;
  if (s.state === "denied" || !s.me) return <Denied why={s.why} />;
  return (
    <PanelShell variant="user" nav={NAV} me={s.me}>
      {children}
    </PanelShell>
  );
}
