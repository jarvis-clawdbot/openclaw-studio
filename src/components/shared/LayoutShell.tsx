"use client";

import { CommandPalette, useCommandPalette } from "@/components/shared/CommandPalette";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette();
  return (
    <>
      {children}
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}
