"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/config";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title: string; items: NavItem[] };


const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: "🏠" },
      { href: "/topology", label: "Topology", icon: "🗺️" },
      { href: "/analytics", label: "Analytics", icon: "📊" },
    ],
  },
  {
    title: "Agents",
    items: [
      { href: "/agents", label: "Agent Fleet", icon: "🤖" },
      { href: "/command-center", label: "Command", icon: "🎛️" },
      { href: "/replay", label: "Replay", icon: "⏪" },
      { href: "/sessions", label: "Sessions", icon: "💬" },
    ],
  },
  {
    title: "Work",
    items: [
      { href: "/tasks", label: "Tasks", icon: "📋" },
      { href: "/boards", label: "Boards", icon: "🗂️" },
      { href: "/approvals", label: "Approvals", icon: "✅" },
      { href: "/tags", label: "Tags", icon: "🏷️" },
    ],
  },
  {
    title: "Monitor",
    items: [
      { href: "/logs", label: "Logs", icon: "📄" },
      { href: "/audit", label: "Audit", icon: "📜" },
      { href: "/memory", label: "Memory", icon: "🧠" },
    ],
  },
  {
    title: "Config",
    items: [
      { href: "/gateways", label: "Gateways", icon: "🌐" },
      { href: "/nodes", label: "Nodes", icon: "📱" },
      { href: "/skills", label: "Skills", icon: "🔌" },
      { href: "/cron", label: "Cron Jobs", icon: "⏰" },
      { href: "/webhooks", label: "Webhooks", icon: "🔗" },
      { href: "/organizations", label: "Organizations", icon: "🏢" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [backendOk, setBackendOk] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`, { signal: AbortSignal.timeout(3000) });
        setBackendOk(res.ok);
      } catch {
        setBackendOk(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav className="w-16 md:w-56 bg-slate-950/80 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 gradient-animated rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
            <span className="text-white font-bold text-sm">OC</span>
          </div>
          <div className="hidden md:block">
            <span className="text-white font-semibold text-sm block leading-tight">OpenClaw</span>
            <span className="text-white/30 text-[10px] block">Studio</span>
          </div>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 py-3 overflow-y-auto dashboard-scroll">
        {navSections.map((section) => (
          <div key={section.title} className="mb-2">
            <div className="px-4 py-1.5">
              <span className="hidden md:block text-[10px] font-semibold uppercase tracking-[0.15em] text-white/20">{section.title}</span>
            </div>
            <ul className="px-2 space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-sm relative group ${
                        isActive
                          ? "bg-blue-600/15 text-blue-400"
                          : "text-white/40 hover:bg-white/5 hover:text-white/80"
                      }`}
                      title={item.label}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-400 rounded-full" />
                      )}
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      <span className="hidden md:block font-medium truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/5">
        <a
          href={`${BACKEND_URL}/api/health`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/30 hover:text-white/60 flex items-center gap-2 transition-colors"
        >
          <div className={`w-2 h-2 rounded-full ${backendOk ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
          <span className="hidden md:block">{backendOk ? "Backend Online" : "Backend Offline"}</span>
        </a>
      </div>
    </nav>
  );
}
