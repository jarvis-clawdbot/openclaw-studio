"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Fleet", icon: "🤖" },
  { href: "/agents", label: "Agents", icon: "🧑‍💻" },
  { href: "/topology", label: "Topology", icon: "🗺️" },
  { href: "/tasks", label: "Tasks", icon: "📋" },
  { href: "/analytics", label: "Analytics", icon: "📊" },
  { href: "/replay", label: "Replay", icon: "⏪" },
  { href: "/audit", label: "Audit", icon: "📜" },
  { href: "/approvals", label: "Approvals", icon: "✅" },
  { href: "/skills", label: "Skills", icon: "🔌" },
  { href: "/tags", label: "Tags", icon: "🏷️" },
  { href: "/boards", label: "Boards", icon: "🗂️" },
  { href: "/gateways", label: "Gateways", icon: "🌐" },
  { href: "/cron", label: "Cron Jobs", icon: "⏰" },
  { href: "/webhooks", label: "Webhooks", icon: "🔗" },
  { href: "/organizations", label: "Organizations", icon: "🏢" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
  { href: "/logs", label: "Logs", icon: "📄" },
  { href: "/nodes", label: "Nodes", icon: "📱" },
  { href: "/memory", label: "Memory", icon: "🧠" },
  { href: "/sessions", label: "Sessions", icon: "💬" },
  { href: "/command-center", label: "Command", icon: "🎛️" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="w-16 md:w-48 bg-slate-900 border-r border-slate-700 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-700">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">DV</span>
          </div>
          <span className="hidden md:block text-white font-semibold">Dashboard Vision</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                  title={item.label}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="hidden md:block text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <a
          href="http://localhost:8000/api/health"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="hidden md:block">Backend OK</span>
        </a>
      </div>
    </nav>
  );
}
