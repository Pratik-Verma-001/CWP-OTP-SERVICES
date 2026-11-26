import Link from "next/link";
import DocsView from "@/components/docs/DocsView";
import { Backdrop, Logo } from "@/components/ui";

export const metadata = { title: "Documentation | CWP OTP Services" };

// Public documentation: readable without signing in, so integrators can follow it from anywhere.
export default function PublicDocs() {
  return (
    <>
      <Backdrop />
      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-6">
        <header className="liquid flex items-center gap-3 rounded-2xl px-4 py-3">
          <Logo size={36} className="relative" />
          <div className="relative min-w-0 flex-1"><div className="glow-text text-base font-bold leading-none">CWP OTP Services</div><div className="text-xs text-slate-400">Documentation</div></div>
          <Link href="/login" className="relative rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">Sign in</Link>
          <Link href="/register" className="relative hidden rounded-xl bg-gradient-to-r from-a1 to-a2 px-3 py-2 text-sm font-medium text-white sm:block">Create account</Link>
        </header>
        <DocsView />
      </div>
    </>
  );
}
