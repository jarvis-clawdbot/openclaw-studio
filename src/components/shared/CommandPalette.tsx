"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

interface Command {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  group: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const commands: Command[] = [
    { id: "nav-fleet", label: "Go to Fleet", icon: "🤖", group: "Navigation", action: () => { router.push("/"); onClose(); } },
    { id: "nav-topology", label: "Go to Topology", icon: "🗺️", group: "Navigation", action: () => { router.push("/topology"); onClose(); } },
    { id: "nav-tasks", label: "Go to Tasks", icon: "📋", group: "Navigation", action: () => { router.push("/tasks"); onClose(); } },
    { id: "nav-analytics", label: "Go to Analytics", icon: "📊", group: "Navigation", action: () => { router.push("/analytics"); onClose(); } },
    { id: "nav-replay", label: "Go to Replay", icon: "⏪", group: "Navigation", action: () => { router.push("/replay"); onClose(); } },
    { id: "nav-command", label: "Go to Command Center", icon: "🎛️", group: "Navigation", action: () => { router.push("/command-center"); onClose(); } },
  ];

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && filtered.length > 0) {
        filtered[0].action();
      }
    },
    [filtered, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <span className="text-slate-400">⌘</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className="flex-1 bg-transparent text-white placeholder-slate-500 focus:outline-none text-sm"
          />
          <kbd className="text-slate-600 text-xs border border-slate-700 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group}>
              <div className="px-4 py-1.5 text-xs text-slate-500 uppercase tracking-wider">{group}</div>
              {cmds.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
                >
                  <span className="text-lg">{cmd.icon}</span>
                  <span className="text-slate-200 text-sm">{cmd.label}</span>
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-slate-500 text-sm">No commands found</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to wire up Cmd+K globally
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useKeyboardShortcuts([
    { key: "k", meta: true, handler: () => setOpen(true) },
  ]);
  return { open, setOpen };
}
