export interface WorkflowConfig {
  steps: Array<{ agent: string; task: string; dependsOn?: string[] }>;
  parallel?: boolean;
}

export interface WorkflowResult {
  success: boolean;
  results: Array<{ step: string; result: string; success: boolean }>;
  totalDurationMs: number;
}
