export interface AgentTemplate {
  mode: string;
  label: string;
  description: string;
  runner: string;
  capabilities: string[];
  defaultModel?: string;
  systemPrompt?: string;
}

export const BUILTIN_TEMPLATES: AgentTemplate[] = [
  {
    mode: "browser",
    label: "Browser Agent",
    description: "Navigates the web, extracts content, and interacts with pages",
    runner: "browser-runner",
    capabilities: ["web-navigation", "content-extraction", "form-interaction"],
    defaultModel: "gpt-4o",
    systemPrompt:
      "You are a web browsing agent. Navigate pages, extract information, and interact with web elements.",
  },
  {
    mode: "coding",
    label: "Coding Agent",
    description: "Generates, edits, and refactors code",
    runner: "coding-runner",
    capabilities: ["code-generation", "code-editing", "debugging", "refactoring"],
    defaultModel: "gpt-4o",
    systemPrompt:
      "You are a coding agent. Write, edit, and debug code with precision.",
  },
  {
    mode: "orchestrator",
    label: "Orchestrator Agent",
    description: "Decomposes complex tasks and delegates to specialized subagents",
    runner: "orchestrator-runner",
    capabilities: ["task-decomposition", "delegation", "result-aggregation"],
    defaultModel: "gpt-4o",
    systemPrompt:
      "You are an orchestration agent. Break down complex tasks and delegate to the appropriate agents.",
  },
  {
    mode: "chat",
    label: "Chat Agent",
    description: "Handles conversational interactions and Q&A",
    runner: "chat-runner",
    capabilities: ["conversation", "question-answering", "summarization"],
    defaultModel: "gpt-4o-mini",
    systemPrompt:
      "You are a conversational agent. Answer questions and assist with general tasks.",
  },
];
