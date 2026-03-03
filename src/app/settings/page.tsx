"use client";

import { useEffect, useState } from "react";

const SETTINGS_KEY = "dv_settings";

const DEFAULT_SETTINGS = {
  autoSave: true,
  darkMode: true,
  notifications: true,
  soundEffects: false,
  compactView: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = (key: keyof typeof DEFAULT_SETTINGS, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {}
  };



  return (
    <div className="h-screen bg-slate-950 p-6 overflow-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-white/40 mt-1">Configure dashboard preferences</p>
        </div>
        {saved && <span className="text-sm text-emerald-400">✓ Saved</span>}
      </div>

      <div className="max-w-2xl space-y-6">
        {/* General */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">General</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white/80">Auto-save changes</span>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => update("autoSave", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white/80">Dark mode</span>
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => update("darkMode", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white/80">Compact view</span>
              <input
                type="checkbox"
                checked={settings.compactView}
                onChange={(e) => update("compactView", e.target.checked)}
                className="rounded"
              />
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Notifications</h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white/80">Enable notifications</span>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => update("notifications", e.target.checked)}
                className="rounded"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-white/80">Sound effects</span>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) => update("soundEffects", e.target.checked)}
                className="rounded"
              />
            </label>
          </div>
        </div>

        {/* Gateway */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Gateway Connection</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Gateway URL</label>
              <input
                type="text"
                defaultValue="ws://localhost:18789"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Auth Token</label>
              <input
                type="password"
                placeholder="Configured in backend .env"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm"
                readOnly
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-white/30 text-center">Settings are saved automatically to your browser.</p>
      </div>
    </div>
  );
}
