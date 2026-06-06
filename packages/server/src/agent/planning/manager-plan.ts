import type { Strategy } from "../../core/types";

export interface ManagerPlan {
  subtasks: Array<{ task: string; strategy: Strategy; delegateTo?: string }>;
  coordinationNotes: string;
}
