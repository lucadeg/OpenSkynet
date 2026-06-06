import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (diffSec < 60) return timeStr;
  if (diffMin < 60) return timeStr;
  if (diffHour < 24) return timeStr;
  if (diffDay === 1) return `Yesterday ${timeStr}`;
  if (diffDay < 7) return `${diffDay}d ago ${timeStr}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` ${timeStr}`;
}
