const AVG_CHARS_PER_TOKEN = 4;

export class ConversationManager {
  private messages: Array<{ role: string; content: string }> = [];

  add(role: string, content: string): void {
    this.messages.push({ role, content });
  }

  getMessages(): Array<{ role: string; content: string }> {
    return [...this.messages];
  }

  setMessages(messages: Array<{ role: string; content: string }>): void {
    this.messages = [...messages];
  }

  clear(): void {
    this.messages = [];
  }

  getRecent(count: number): Array<{ role: string; content: string }> {
    return this.messages.slice(-count);
  }

  getTokenCount(): number {
    const totalChars = this.messages.reduce(
      (sum, m) => sum + m.content.length,
      0,
    );
    return Math.ceil(totalChars / AVG_CHARS_PER_TOKEN);
  }
}
