export interface AgentConfig {
  maxIterations: number;
  compressThreshold: number;
  maxNestedDepth: number;
  headless: boolean;
  provider: string;
  model?: string;
  baseUrl?: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 50,
  compressThreshold: 20,
  maxNestedDepth: 2,
  headless: true,
  provider: "openai",
};
