const STORE_PATTERNS = [
  /(?:remember|memorize|save|store|keep|note|don'?t forget)\b/i,
  /(?:write this down|take note|bear in mind)/i,
  /(?:i want you to know|for future reference)/i,
];

const RECALL_PATTERNS = [
  /(?:what (?:do you|did you) (?:know|remember)|do you remember|recall)/i,
  /(?:what (?:is|are|was)|who (?:is|are|was)|where (?:is|are|was))/i,
  /(?:tell me about|what about|how do i|how to)/i,
];

const TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/(?:my name is|i'm called|i am)\s+(\w+)/i, "name"],
  [/(?:my favorite|i prefer|i like)\s+(.+?)(?:\.|$)/i, "preference"],
  [/(?:how to|steps? to)\s+(.+?)(?:\.|$)/i, "procedure"],
  [/(?:where is|location of)\s+(.+?)(?:\.|$)/i, "location"],
];

export class Intenter {
  detectIntent(text: string): {
    wantsMemory: boolean;
    wantsRecall: boolean;
    topic?: string;
  } {
    const wantsStore = STORE_PATTERNS.some((p) => p.test(text));
    const wantsRecall = RECALL_PATTERNS.some((p) => p.test(text));

    let topic: string | undefined;
    for (const [pattern, label] of TOPIC_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        topic = label === "name" || label === "location" ? label : match[1]?.trim() ?? label;
        break;
      }
    }

    return { wantsMemory: wantsStore, wantsRecall, topic };
  }
}
