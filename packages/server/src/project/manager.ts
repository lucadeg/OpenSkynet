import { join } from "node:path";
import { getDb } from "../store/db";
import { getConfig } from "../core/config";
import logger from "../core/logging";
import { BrowserSession } from "../browser/session";
import { BrowserController } from "../browser/controller";
import { AgentLoop } from "../agent/loop";
import { createAgentToolRegistry } from "../agent/tools";
import { registerBrowserTools } from "../agent/tools/browser-tools";
import type { LLMProvider } from "../llm/provider";
import type { BaseMemoryStrategy } from "../memory/strategy";
import type { SkillEngine } from "../skills/engine";
import type { Project, ProjectConversation, ProjectConfig } from "../core/types";
import type { ToolBus } from "../agent/tools/bus";

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }).toLowerCase();
}

const DEFAULT_PROJECT_ID = "__default__";

export interface ProjectInstance {
  browserController: BrowserController;
  browserSession: BrowserSession;
  toolBus: ToolBus;
  agentLoop: AgentLoop;
}

export class ProjectManager {
  private projects: Map<string, ProjectInstance> = new Map();
  private llmProvider: LLMProvider;
  private memory: BaseMemoryStrategy;
  private skillEngine: SkillEngine;
  private headless: boolean;
  private terminalAllowed: boolean;

  constructor(opts: {
    llmProvider: LLMProvider;
    memory: BaseMemoryStrategy;
    skillEngine: SkillEngine;
    headless?: boolean;
    terminalAllowed?: boolean;
  }) {
    this.llmProvider = opts.llmProvider;
    this.memory = opts.memory;
    this.skillEngine = opts.skillEngine;
    this.headless = opts.headless ?? true;
    this.terminalAllowed = opts.terminalAllowed ?? false;
  }

  private get db() {
    return getDb();
  }

  private projectDir(projectId: string): string {
    const config = getConfig();
    return join(config.dataDir, "projects", projectId);
  }

  private browserProfileDir(projectId: string): string {
    return join(this.projectDir(projectId), "browser-profile");
  }

  private rowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      userDataDir: row.user_data_dir,
      headless: row.headless === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private rowToConversation(row: any): ProjectConversation {
    return {
      id: row.id,
      projectId: row.project_id,
      task: row.task,
      stepsJson: row.steps_json ?? "[]",
      result: row.result ?? undefined,
      agentMode: row.agent_mode ?? "browser",
      createdAt: row.created_at,
    };
  }

  async createProject(config: ProjectConfig): Promise<Project> {
    const id = generateUUID();
    const userDataDir = this.browserProfileDir(id);
    const headlessNum = config.headless ?? this.headless ? 1 : 0;

    const stmt = this.db.prepare(
      `INSERT INTO projects (id, name, description, user_data_dir, headless)
       VALUES (?, ?, ?, ?, ?)`
    );
    stmt.run(id, config.name, config.description ?? "", userDataDir, headlessNum);

    logger.info({ projectId: id, name: config.name }, "project_created");
    return (await this.getProject(id))!;
  }

  getProject(id: string): Project | null {
    const row = this.db
      .query("SELECT * FROM projects WHERE id = ?")
      .get(id) as any;
    return row ? this.rowToProject(row) : null;
  }

  listProjects(): Project[] {
    const rows = this.db
      .query("SELECT * FROM projects ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((r) => this.rowToProject(r));
  }

  updateProject(
    id: string,
    updates: { name?: string; description?: string; headless?: boolean }
  ): Project | null {
    const existing = this.getProject(id);
    if (!existing) return null;

    const name = updates.name ?? existing.name;
    const description = updates.description ?? existing.description;
    const headlessNum =
      updates.headless !== undefined ? (updates.headless ? 1 : 0) : (existing.headless ? 1 : 0);

    this.db
      .prepare(
        `UPDATE projects SET name = ?, description = ?, headless = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      )
      .run(name, description, headlessNum, id);

    return this.getProject(id);
  }

  async deleteProject(id: string): Promise<boolean> {
    if (id === DEFAULT_PROJECT_ID) return false;

    const existing = this.getProject(id);
    if (!existing) return false;

    await this.stopProjectBrowser(id);

    this.db.prepare("DELETE FROM project_conversations WHERE project_id = ?").run(id);
    this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);

    logger.info({ projectId: id }, "project_deleted");
    return true;
  }

  async getOrCreateBrowser(projectId: string): Promise<ProjectInstance> {
    let instance = this.projects.get(projectId);
    if (instance) return instance;

    const project = this.getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const config = getConfig();

    const browserSession = new BrowserSession({
      headless: project.headless,
      stealth: config.stealthEnabled,
      proxy: config.stealthProxy || undefined,
      userDataDir: project.userDataDir,
    });

    const browserController = new BrowserController({
      headless: project.headless,
      userDataDir: project.userDataDir,
    });

    await browserController.start();

    const toolBus = createAgentToolRegistry({
      terminalAllowed: this.terminalAllowed,
      memoryManager: this.memory,
      skillEngine: this.skillEngine,
      enableBrowserTools: true,
      browserController,
    });

    const agentLoop = new AgentLoop({
      llmProvider: this.llmProvider,
      browserSession,
      memory: this.memory,
      skillEngine: this.skillEngine,
      toolBus,
      headless: project.headless,
    });

    instance = { browserController, browserSession, toolBus, agentLoop };
    this.projects.set(projectId, instance);

    logger.info({ projectId }, "project_browser_started");
    return instance;
  }

  async stopProjectBrowser(projectId: string): Promise<void> {
    const instance = this.projects.get(projectId);
    if (!instance) return;

    try {
      await instance.browserController.stop();
    } catch (err) {
      logger.error({ projectId, err: (err as Error).message }, "project_browser_stop_error");
    }

    this.projects.delete(projectId);
    logger.info({ projectId }, "project_browser_stopped");
  }

  getBrowserController(projectId: string): BrowserController | null {
    return this.projects.get(projectId)?.browserController ?? null;
  }

  createConversation(
    projectId: string,
    task: string,
    agentMode?: string
  ): ProjectConversation {
    const id = generateUUID();

    this.db
      .prepare(
        `INSERT INTO project_conversations (id, project_id, task, steps_json, agent_mode)
         VALUES (?, ?, ?, '[]', ?)`
      )
      .run(id, projectId, task, agentMode ?? "browser");

    const row = this.db
      .query("SELECT * FROM project_conversations WHERE id = ?")
      .get(id) as any;

    return this.rowToConversation(row);
  }

  updateConversation(
    conversationId: string,
    updates: { result?: string; stepsJson?: string }
  ): boolean {
    const existing = this.db
      .query("SELECT id FROM project_conversations WHERE id = ?")
      .get(conversationId) as any;
    if (!existing) return false;

    if (updates.result !== undefined) {
      this.db
        .prepare("UPDATE project_conversations SET result = ? WHERE id = ?")
        .run(updates.result, conversationId);
    }
    if (updates.stepsJson !== undefined) {
      this.db
        .prepare("UPDATE project_conversations SET steps_json = ? WHERE id = ?")
        .run(updates.stepsJson, conversationId);
    }
    return true;
  }

  listConversations(projectId: string): ProjectConversation[] {
    const rows = this.db
      .query(
        "SELECT * FROM project_conversations WHERE project_id = ? ORDER BY created_at DESC"
      )
      .all(projectId) as any[];
    return rows.map((r) => this.rowToConversation(r));
  }

  getConversation(conversationId: string): ProjectConversation | null {
    const row = this.db
      .query("SELECT * FROM project_conversations WHERE id = ?")
      .get(conversationId) as any;
    return row ? this.rowToConversation(row) : null;
  }

  deleteConversation(conversationId: string): boolean {
    const existing = this.db
      .query("SELECT id FROM project_conversations WHERE id = ?")
      .get(conversationId) as any;
    if (!existing) return false;

    this.db
      .prepare("DELETE FROM project_conversations WHERE id = ?")
      .run(conversationId);
    return true;
  }

  async ensureDefaultProject(): Promise<Project> {
    let project = this.getProject(DEFAULT_PROJECT_ID);
    if (project) return project;

    const config = getConfig();
    const userDataDir = config.browserProfileDir;

    this.db
      .prepare(
        `INSERT INTO projects (id, name, description, user_data_dir, headless)
         VALUES (?, 'Default', 'Default project for legacy tasks', ?, ?)`
      )
      .run(DEFAULT_PROJECT_ID, userDataDir, this.headless ? 1 : 0);

    logger.info("default_project_created");
    return (await this.getProject(DEFAULT_PROJECT_ID))!;
  }

  async shutdown(): Promise<void> {
    for (const [projectId] of this.projects) {
      await this.stopProjectBrowser(projectId);
    }
    logger.info("project_manager_shutdown");
  }
}
