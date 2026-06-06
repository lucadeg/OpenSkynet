export interface SidecarRequest {
  type: "init" | "run_task" | "stop" | "screenshot" | "save_state" | "load_state";
  id: string;
  payload: Record<string, unknown>;
}

export interface SidecarResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface SidecarEvent {
  type: "step" | "streaming" | "progress";
  data: Record<string, unknown>;
}

export interface RunTaskOptions {
  task: string;
  max_steps?: number;
  flash_mode?: boolean;
  system_prompt?: string;
  use_vision?: boolean;
}

export interface RunTaskResult {
  result: string;
  actions: Array<Record<string, unknown>>;
}
