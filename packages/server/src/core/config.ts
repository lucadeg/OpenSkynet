import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  dataDir: string;
  skillsDir: string;
  memoryDir: string;
  sessionsDir: string;
  cronDir: string;
  recordingsDir: string;
  agentsDir: string;
  browserProfileDir: string;
  soulFile: string;
  contextFile: string;
  agentStateFile: string;
  historyFile: string;
  screenshotFile: string;
  trajectoriesDir: string;
  memoryLimit: number;
  userLimit: number;
  maxStructuredBytes: number;
  memorySystem: "file" | "hy";
  hyMemoryDb: string;
  maxEntriesPerType: number;
  maxTaskLength: number;
  maxNameLength: number;
  maxCronFields: number;
  safeNameRe: RegExp;
  cronFieldRe: RegExp;
  frontmatterRe: RegExp;
  maxResultChars: number;
  maxResultsPerJob: number;
  maxRecordingSeconds: number;
  compressThreshold: number;
  skillStaleDays: number;
  maxNestedDepth: number;
  defaultHttpTimeout: number;
  defaultWebMaxChars: number;
  corsOrigins: string[];
  stealthEnabled: boolean;
  stealthProxy: string;
  stealthFingerprintSeed: string;
  stealthBinaryPath: string;
  integrationsConfigPath: string;
  openbrowserHost: string;
  openbrowserPort: number;
  agentBrowserBinary: string;
  authFile: string;
  dbPath: string;
}

let _config: Config | null = null;

export function resetConfig(): void {
  _config = null;
}

function _envBool(key: string, def: string): boolean {
  const val = (process.env[key] ?? def).toLowerCase().trim();
  return val === "true" || val === "1" || val === "yes";
}

export function getConfig(): Config {
  if (_config) return _config;

  const dataDir =
    process.env.SEDIMAN_DATA_DIR || join(homedir(), ".terminator");

  const config: Config = {
    dataDir,
    skillsDir: join(dataDir, "skills"),
    memoryDir: join(dataDir, "memories"),
    sessionsDir: join(dataDir, "sessions"),
    cronDir: join(dataDir, "cron"),
    recordingsDir: join(dataDir, "recordings"),
    agentsDir: join(dataDir, "agents"),
    browserProfileDir: join(dataDir, "browser-profile-cron"),
    soulFile: join(dataDir, "SOUL.md"),
    contextFile: join(dataDir, "CONTEXT.md"),
    agentStateFile: join(dataDir, "agent_state.json"),
    historyFile: join(dataDir, "history"),
    screenshotFile: join(dataDir, "last_screenshot.png"),
    trajectoriesDir: join(dataDir, "trajectories"),

    memoryLimit: parseInt(process.env.SEDIMAN_MEMORY_LIMIT ?? "2200", 10),
    userLimit: parseInt(process.env.SEDIMAN_USER_LIMIT ?? "1375", 10),
    maxStructuredBytes: parseInt(
      process.env.SEDIMAN_MAX_STRUCTURED_BYTES ?? "50000",
      10,
    ),

    memorySystem:
      (process.env.SEDIMAN_MEMORY_SYSTEM as "file" | "hy") ?? "file",
    hyMemoryDb: join(dataDir, "hy_memory.db"),
    maxEntriesPerType: parseInt(
      process.env.SEDIMAN_MAX_ENTRIES_PER_TYPE ?? "50",
      10,
    ),

    maxTaskLength: 10000,
    maxNameLength: 64,
    maxCronFields: 5,
    safeNameRe: /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    cronFieldRe: /^\s*(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/,
    frontmatterRe: /^---\s*\n(.*?)\n---\s*\n/s,

    maxResultChars: parseInt(
      process.env.SEDIMAN_MAX_RESULT_CHARS ?? "2000",
      10,
    ),
    maxResultsPerJob: parseInt(
      process.env.SEDIMAN_MAX_RESULTS_PER_JOB ?? "100",
      10,
    ),
    maxRecordingSeconds: parseInt(
      process.env.SEDIMAN_MAX_RECORDING_SECONDS ?? "300",
      10,
    ),

    compressThreshold: parseInt(
      process.env.SEDIMAN_COMPRESS_THRESHOLD ?? "20",
      10,
    ),
    skillStaleDays: parseInt(
      process.env.SEDIMAN_SKILL_STALE_DAYS ?? "30",
      10,
    ),
    maxNestedDepth: parseInt(
      process.env.SEDIMAN_MAX_NESTED_DEPTH ?? "2",
      10,
    ),

    defaultHttpTimeout: parseFloat(
      process.env.SEDIMAN_HTTP_TIMEOUT ?? "15.0",
    ),
    defaultWebMaxChars: parseInt(
      process.env.SEDIMAN_WEB_MAX_CHARS ?? "5000",
      10,
    ),

    corsOrigins: (process.env.SEDIMAN_CORS_ORIGINS ??
      "http://localhost:3000,http://localhost:5173")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),

    stealthEnabled: _envBool("SEDIMAN_STEALTH", "true"),
    stealthProxy: process.env.SEDIMAN_STEALTH_PROXY ?? "",
    stealthFingerprintSeed:
      process.env.SEDIMAN_STEALTH_FINGERPRINT_SEED ?? "",
    stealthBinaryPath: process.env.SEDIMAN_STEALTH_BINARY_PATH ?? "",

    integrationsConfigPath: join(dataDir, "integrations.json"),

    openbrowserHost: process.env.SEDIMAN_OPENBROWSER_HOST ?? "127.0.0.1",
    openbrowserPort: parseInt(
      process.env.SEDIMAN_OPENBROWSER_PORT ?? "7788",
      10,
    ),
    agentBrowserBinary: process.env.SEDIMAN_AGENTBROWSER_BINARY ?? "",

    authFile: join(dataDir, "auth.json"),
    dbPath: join(dataDir, "state.db"),
  };

  Object.freeze(config);
  _config = config;
  return _config;
}
