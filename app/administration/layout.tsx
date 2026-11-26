"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminSession } from "@/lib/client/adminSession";
import { prefetchApi } from "@/lib/client/api";
import PanelShell, { type NavItem } from "@/components/shell/PanelShell";
import { Splash } from "@/components/ui";

const NAV: NavItem[] = [
  { label: "Overview", short: "Home", href: "/administration", icon: "dashboard", group: "Overview", exact: true, dock: true },
  { label: "Users", href: "/administration/users", icon: "users", group: "People", dock: true },
  { label: "Features", href: "/administration/features", icon: "star", group: "People", dock: true },
  { label: "WhatsApp", href: "/administration/worker", icon: "chat", group: "Connections", dock: true },
  { label: "Email", href: "/administration/email", icon: "mail", group: "Connections" },
  { label: "Settings", href: "/administration/settings", icon: "settings", group: "System" },
  { label: "Audit log", href: "/administration/audit", icon: "clipboard", group: "System" },
];

// The administration area has its own login (cookie session). User accounts can never enter it;
// every /api/administration/* route re-checks the session on the server.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname(), router = useRouter();
  const isLogin = path === "/administration/login";
  const s = useAdminSession(!isLogin);
  useEffect(() => { if (s.state === "ok") prefetchApi(["/api/administration/overview", "/api/administration/users?page=1"]); }, [s.state]);
  if (isLogin) return <>{children}</>;
  if (s.state !== "ok") return <Splash />;
  const me = { id: "admin", email: s.username, name: "Administrator", role: "admin" as const, status: "active", features: {}, limits: {}, announcement: "", maintenance: false };
  return (
    <PanelShell variant="admin" nav={NAV} me={me} switchTo={{ label: "Documentation", href: "/docs", icon: "docs" }}
      onLogout={async () => { await fetch("/api/administration/logout", { method: "POST" }); router.replace("/administration/login"); }}>
      {children}
    </PanelShell>
  );
}
