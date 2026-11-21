import "./globals.css";
export const metadata = { title: "CWP OTP Services" };
export const viewport = { themeColor: "#050a1c", width: "device-width", initialScale: 1, viewportFit: "cover" as const };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="min-h-screen antialiased">{children}</body></html>;
}
