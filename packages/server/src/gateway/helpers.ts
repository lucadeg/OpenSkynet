export function truncateMessage(content: string, maxLength: number = 2000): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 3) + "...";
}

export function formatAgentResult(result: string): string {
  const stripped = result.trim();
  if (stripped.length === 0) return "*(no output)*";
  return stripped;
}
