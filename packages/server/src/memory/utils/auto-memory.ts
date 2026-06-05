import type { MemoryType } from "../../core/types";

interface ExtractedMemory {
  content: string;
  type: MemoryType;
  source: string;
}

const PREFERENCE_PATTERNS = [
  /(?:i (?:prefer|like|love|hate|dislike|want|need|always|never))\s+(.+)/i,
  /(?:my (?:favorite|preferred|default)\s+\w+\s+(?:is|are))\s+(.+)/i,
  /(?:please (?:always|never|use|don't))\s+(.+)/i,
];

const FACT_PATTERNS = [
  /(?:i (?:am|work|live|have|use))\s+(.+)/i,
  /(?:my (?:name|email|phone|company|role|project)\s+(?:is|are))\s+(.+)/i,
  /(?:the (?:password|key|token|url|endpoint)\s+(?:is|for))\s+(.+)/i,
];

const PROCEDURE_PATTERNS = [
  /(?:first\s+.+then\s+.+)/i,
  /(?:step\s+\d)/i,
  /(?:to\s+\w+,\s+(?:first\s+)?(?:you\s+)?(?:need\s+to\s+)?)/i,
  /(?:always\s+(?:make sure|ensure|remember)\s+(?:to\s+)?)/i,
];

export function extractMemoriesFromConversation(
  messages: Array<{ role: string; content: string }>,
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "user") continue;

    for (const pattern of PREFERENCE_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match && match[0].length > 10 && match[0].length < 500) {
        const content = match[0].trim();
        if (!seen.has(content)) {
          seen.add(content);
          memories.push({ content, type: "preference", source: "auto" });
        }
      }
    }

    for (const pattern of FACT_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match && match[0].length > 10 && match[0].length < 500) {
        const content = match[0].trim();
        if (!seen.has(content)) {
          seen.add(content);
          memories.push({ content, type: "fact", source: "auto" });
        }
      }
    }

    for (const pattern of PROCEDURE_PATTERNS) {
      const match = msg.content.match(pattern);
      if (match && msg.content.length > 20 && msg.content.length < 1000) {
        const content = msg.content.trim();
        if (!seen.has(content)) {
          seen.add(content);
          memories.push({ content, type: "procedure", source: "auto" });
        }
      }
    }
  }

  return memories;
}
