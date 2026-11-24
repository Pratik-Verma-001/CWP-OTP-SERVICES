"use client";
import { useEffect } from "react";
import { useSession } from "@/lib/client/session";
import { prefetchApi } from "@/lib/client/api";
import PanelShell, { type NavItem } from "@/components/shell/PanelShell";
import Denied from "@/components/shell/Denied";
import { Splash } from "@/components/ui";

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
  useEffect(() => { if (s.state === "ok" && (s.me?.role === "owner" || s.me?.role === "admin")) prefetchApi(["/api/administration/overview", "/api/administration/users?page=1"]); }, [s.state, s.me?.role]);
  if (s.state === "loading") return <Splash />;
  if (s.state === "denied" || !s.me) return <Denied why={s.why} />;
  if (s.me.role !== "owner" && s.me.role !== "admin")
    return <Denied title="Administrators only" why="Your account does not have access to the administration panel." back={{ label: "Go to my dashboard", href: "/dashboard" }} />;
  return (
    <PanelShell variant="admin" nav={NAV} me={s.me} switchTo={{ label: "User panel", href: "/dashboard", icon: "back" }}>
      {children}
    </PanelShell>
  );
}
