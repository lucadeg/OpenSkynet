/**
 * Project context discovery for the Coding Agent.
 * Detects project structure, language, framework, and configuration.
 */

import { readdir, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ProjectInfo } from "./types";

export async function discoverProject(startPath?: string): Promise<ProjectInfo> {
  const root = startPath || process.cwd();

  const info: ProjectInfo = {
    root,
  };

  // Detect language by file extensions
  const language = await detectLanguage(root);
  if (language) {
    info.language = language;
  }

  // Detect package manager
  const packageManager = await detectPackageManager(root);
  if (packageManager) {
    info.packageManager = packageManager;
  }

  // Detect build system
  const buildSystem = await detectBuildSystem(root);
  if (buildSystem) {
    info.buildSystem = buildSystem;
  }

  // Detect test framework
  const testFramework = await detectTestFramework(root);
  if (testFramework) {
    info.testFramework = testFramework;
  }

  // Detect frameworks
  const frameworks = await detectFrameworks(root);
  if (frameworks.length > 0) {
    info.frameworks = frameworks;
  }

  // Read package.json if exists
  if (existsSync(join(root, "package.json"))) {
    try {
      const pkgJson = JSON.parse(await readFile(join(root, "package.json"), "utf-8"));
      info.name = pkgJson.name;
      info.dependencies = pkgJson.dependencies;
      info.devDependencies = pkgJson.devDependencies;
      info.scripts = pkgJson.scripts;
    } catch {
      // Ignore parse errors
    }
  }

  // Read pyproject.toml or requirements.txt for Python
  if (info.language === "python") {
    if (existsSync(join(root, "pyproject.toml"))) {
      try {
        const pyproject = await readFile(join(root, "pyproject.toml"), "utf-8");
        // Parse basic info (simplified)
        const nameMatch = pyproject.match(/name\s*=\s*["']([^"']+)["']/);
        if (nameMatch) {
          info.name = nameMatch[1];
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Read Cargo.toml for Rust
  if (info.language === "rust") {
    if (existsSync(join(root, "Cargo.toml"))) {
      try {
        const cargoToml = await readFile(join(root, "Cargo.toml"), "utf-8");
        const nameMatch = cargoToml.match(/name\s*=\s*"([^"]+)"/);
        if (nameMatch) {
          info.name = nameMatch[1];
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  return info;
}

async function detectLanguage(root: string): Promise<string | undefined> {
  const files = await readdir(root).catch(() => []);

  // Check for file types
  const hasTypeScript = files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  const hasJavaScript = files.some((f) => f.endsWith(".js") || f.endsWith(".jsx"));
  const hasPython = files.some((f) => f.endsWith(".py"));
  const hasRust = files.some((f) => f.endsWith(".rs"));
  const hasGo = files.some((f) => f.endsWith(".go"));
  const hasJava = files.some((f) => f.endsWith(".java"));
  const hasRuby = files.some((f) => f.endsWith(".rb"));
  const hasC = files.some((f) => f.endsWith(".c") || f.endsWith(".cpp") || f.endsWith(".h"));

  if (hasTypeScript) return "typescript";
  if (hasPython) return "python";
  if (hasRust) return "rust";
  if (hasGo) return "go";
  if (hasJava) return "java";
  if (hasRuby) return "ruby";
  if (hasC) return "c";
  if (hasJavaScript) return "javascript";

  return undefined;
}

async function detectPackageManager(root: string): Promise<string | undefined> {
  if (existsSync(join(root, "package-lock.json"))) return "npm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "bun.lockb"))) return "bun";
  if (existsSync(join(root, "poetry.lock"))) return "poetry";
  if (existsSync(join(root, "Pipfile"))) return "pipenv";
  if (existsSync(join(root, "Cargo.lock"))) return "cargo";
  if (existsSync(join(root, "go.mod"))) return "go";

  return undefined;
}

async function detectBuildSystem(root: string): Promise<string | undefined> {
  if (existsSync(join(root, "tsconfig.json"))) return "tsc";
  if (existsSync(join(root, "webpack.config.js")) || existsSync(join(root, "webpack.config.ts"))) return "webpack";
  if (existsSync(join(root, "vite.config.js")) || existsSync(join(root, "vite.config.ts"))) return "vite";
  if (existsSync(join(root, "next.config.js")) || existsSync(join(root, "next.config.mjs"))) return "next";
  if (existsSync(join(root, "nuxt.config.js")) || existsSync(join(root, "nuxt.config.ts"))) return "nuxt";
  if (existsSync(join(root, "Makefile"))) return "make";
  if (existsSync(join(root, "Cargo.toml"))) return "cargo";
  if (existsSync(join(root, "build.gradle"))) return "gradle";
  if (existsSync(join(root, "pom.xml"))) return "maven";

  return undefined;
}

async function detectTestFramework(root: string): Promise<string | undefined> {
  const files = await readdir(root).catch(() => []);

  if (files.includes("jest.config.js") || files.includes("jest.config.ts")) return "jest";
  if (files.includes("vitest.config.js") || files.includes("vitest.config.ts")) return "vitest";
  if (files.includes("pytest.ini") || files.includes("pyproject.toml")) {
    // Check if pytest is configured
    try {
      const pyproject = await readFile(join(root, "pyproject.toml"), "utf-8");
      if (pyproject.includes("pytest")) return "pytest";
    } catch {
      // Ignore
    }
  }
  if (files.includes("Cargo.toml")) {
    try {
      const cargo = await readFile(join(root, "Cargo.toml"), "utf-8");
      if (cargo.includes("[dev-dependencies]")) return "cargo-test";
    } catch {
      // Ignore
    }
  }

  return undefined;
}

async function detectFrameworks(root: string): Promise<string[]> {
  const frameworks: string[] = [];

  try {
    const pkgJson = existsSync(join(root, "package.json"))
      ? JSON.parse(await readFile(join(root, "package.json"), "utf-8"))
      : null;

    if (pkgJson) {
      const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

      if (deps.react) frameworks.push("react");
      if (deps.vue) frameworks.push("vue");
      if (deps.angular) frameworks.push("angular");
      if (deps.svelte) frameworks.push("svelte");
      if (deps.next || pkgJson.scripts?.next) frameworks.push("next");
      if (deps.nuxt || pkgJson.scripts?.nuxt) frameworks.push("nuxt");
      if (deps.express || pkgJson.scripts?.express) frameworks.push("express");
      if (deps.fastify || pkgJson.scripts?.fastify) frameworks.push("fastify");
      if (deps.nest || pkgJson.scripts?.nest) frameworks.push("nestjs");
      if (deps["@nestjs/core"]) frameworks.push("nestjs");
      if (deps.electron || pkgJson.scripts?.electron) frameworks.push("electron");
      if (deps.tauri || pkgJson.scripts?.tauri) frameworks.push("tauri");
    }
  } catch {
    // Ignore parse errors
  }

  return frameworks;
}

export function getProjectSummary(info: ProjectInfo): string {
  const parts: string[] = [];

  if (info.name) {
    parts.push(`Project: ${info.name}`);
  }

  if (info.language) {
    parts.push(`Language: ${info.language}`);
  }

  if (info.packageManager) {
    parts.push(`Package Manager: ${info.packageManager}`);
  }

  if (info.frameworks && info.frameworks.length > 0) {
    parts.push(`Frameworks: ${info.frameworks.join(", ")}`);
  }

  if (info.testFramework) {
    parts.push(`Testing: ${info.testFramework}`);
  }

  return parts.length > 0 ? parts.join("\n") : "No project information detected";
}
