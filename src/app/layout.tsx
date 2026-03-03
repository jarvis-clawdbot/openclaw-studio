import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/shared/SidebarNav";
import { LayoutShell } from "@/components/shared/LayoutShell";

export const metadata: Metadata = {
  title: "Dashboard Vision | OpenClaw",
  description: "Multi-agent orchestration dashboard for OpenClaw",
};

const display = Bebas_Neue({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const sans = IBM_Plex_Sans({ variable: "--font-sans", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-mono", weight: ["400", "500", "600"], subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "(function(){try{var t=localStorage.getItem('theme');var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=t?t==='dark':m;document.documentElement.classList.toggle('dark',d);}catch(e){}})();",
          }}
        />
      </head>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased bg-slate-950`}>
        <div className="flex h-screen">
          <SidebarNav />
          <main className="flex-1 overflow-hidden">
            <LayoutShell>{children}</LayoutShell>
          </main>
        </div>
      </body>
    </html>
  );
}
