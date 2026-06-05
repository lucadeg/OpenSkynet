export function formatConversationContext(
  messages: Array<{ role: string; content: string }>,
  limit = 10,
  maxChars = 200,
): string {
  const lines: string[] = [];
  const slice = messages.slice(-limit);
  for (const msg of slice) {
    const role = msg.role === "user" ? "User" : "Assistant";
    lines.push(`${role}: ${msg.content.slice(0, maxChars)}`);
  }
  return lines.join("\n");
}

export function relativeTime(timestamp: string, now?: Date): string {
  const ref = now ?? new Date();
  try {
    let ts: Date;
    if (timestamp.includes("T")) {
      ts = new Date(timestamp.replace("Z", "+00:00"));
    } else {
      ts = new Date(timestamp.replace(" ", "T") + "Z");
    }
    const deltaMs = ref.getTime() - ts.getTime();
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return timestamp.slice(0, 10);
  } catch {
    return timestamp;
  }
}

export function extractJsonFromText(
  text: string,
): Record<string, unknown> | Array<unknown> | null {
  if (!text) return null;
  if (text.includes("```json")) {
    text = text.split("```json")[1].split("```")[0];
  } else if (text.includes("```")) {
    text = text.split("```")[1].split("```")[0];
  }
  text = text.trim();
  if (!text.startsWith("{") && !text.startsWith("[")) {
    let found = false;
    for (const [openCh, closeCh] of [
      ["{", "}"] as const,
      ["[", "]"] as const,
    ]) {
      const start = text.indexOf(openCh);
      const end = text.lastIndexOf(closeCh);
      if (start >= 0 && end > start) {
        text = text.slice(start, end + 1);
        found = true;
        break;
      }
    }
    if (!found) return null;
  }
  try {
    return JSON.parse(text) as Record<string, unknown> | Array<unknown>;
  } catch {
    return null;
  }
}
