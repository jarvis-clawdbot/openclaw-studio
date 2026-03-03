"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <nav className="w-16 md:w-52 bg-slate-950 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">OC</span>
          </div>
          <span className="hidden md:block text-white font-semibold text-sm">OpenClaw Studio</span>
        </Link>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 py-2 overflow-y-auto scrollbar-thin">
        {navSections.map((section) => (
          <div key={section.title} className="mb-1">
            <div className="px-4 py-1.5">
              <span className="hidden md:block text-[10px] font-semibold uppercase tracking-wider text-slate-600">{section.title}</span>
            </div>
            <ul className="px-2 space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors text-sm ${
                        isActive
                          ? "bg-blue-600/20 text-blue-400 border border-blue-500/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                      title={item.label}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span className="hidden md:block font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800">
        <a
          href="http://localhost:8000/api/health"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="hidden md:block">Backend Online</span>
        </a>
      </div>
    </nav>
  );
}
