import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

// Static guard: every API route must use the right authentication system.
//  - lib/auth/admin.ts  = Firebase accounts of regular users  (/api/admin/*)
//  - lib/admin-auth.ts  = the ONE platform administrator       (/api/administration/*)
const root = path.resolve(__dirname, "..", "app", "api");
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? walk(p) : n === "route.ts" ? [p] : []; });
const routes = walk(root).map((p) => ({ file: path.relative(root, p).replace(/\\/g, "/"), src: readFileSync(p, "utf8") }));
const PUBLIC_ADMIN = ["administration/login/route.ts", "administration/logout/route.ts", "administration/session/route.ts"];
const importsFrom = (src: string, mod: string) => [...src.matchAll(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*"${mod}"`, "g"))].flatMap((m) => m[1].split(",").map((x) => x.trim().replace(/^type\s+/, "")));

describe("route authentication boundaries", () => {
  it("finds the routes", () => expect(routes.length).toBeGreaterThan(20));

  it("every /api/administration route except login/logout/session requires the admin session", () => {
    for (const r of routes.filter((r) => r.file.startsWith("administration/") && !PUBLIC_ADMIN.includes(r.file))) {
      expect(importsFrom(r.src, "@/lib/admin-auth"), r.file).toContain("requireAdmin");
      expect(r.src, r.file).toMatch(/await requireAdmin\(req\)/);
    }
  });
  it("administration routes never authorize with Firebase user auth", () => {
    for (const r of routes.filter((r) => r.file.startsWith("administration/")))
      expect(importsFrom(r.src, "@/lib/auth/admin").filter((n) => ["requireUser", "checkUser", "audit", "testMailAllowed"].includes(n)), r.file).toEqual([]);
  });
  it("user-panel routes (/api/admin) never import the platform-administrator module", () => {
    for (const r of routes.filter((r) => r.file.startsWith("admin/"))) expect(r.src, r.file).not.toContain('"@/lib/admin-auth"');
  });
  it("nobody imports requireAdmin from the Firebase user module", () => {
    for (const r of routes) expect(importsFrom(r.src, "@/lib/auth/admin"), r.file).not.toContain("requireAdmin");
  });
});
