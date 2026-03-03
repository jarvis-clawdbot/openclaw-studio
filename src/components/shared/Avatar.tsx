"use client";

/**
 * Avatar - Deterministic avatar generation for agents.
 * Simplified color-based avatar (without multiavatar dependency).
 */

type Props = {
  id: string;
  name?: string;
  size?: number;
  className?: string;
};

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
    "#10b981", "#06b6d4", "#6366f1", "#f43f5e",
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ id, name, size = 40, className = "" }: Props) {
  const displayName = name || id;
  const bgColor = stringToColor(id);
  const initials = getInitials(displayName);

  return (
    <div
      className={`flex items-center justify-center rounded-full text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}

export default Avatar;
