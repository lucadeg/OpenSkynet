import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "../../core/config";
import logger from "../../core/logging";
import type { SkillSearchResult } from "../../core/types";
import { BaseSearchStrategy, type SearchResult } from "../base";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function matchScore(queryTerms: string[], name: string, description: string): number {
  const nameTokens = tokenize(name);
  const descTokens = tokenize(description);
  let score = 0;

  for (const term of queryTerms) {
    const nameHit = nameTokens.some((t) => t.includes(term) || term.includes(t));
    const descHit = descTokens.some((t) => t.includes(term) || term.includes(t));

    if (nameHit) score += 2;
    else if (descHit) score += 1;
  }

  return queryTerms.length > 0 ? score / (queryTerms.length * 2) : 0;
}

export class SkillSearchStrategy extends BaseSearchStrategy {
  get name(): string {
    return "skill";
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const config = getConfig();
    const terms = tokenize(query);
    if (terms.length === 0) return [];

    try {
      const entries = await readdir(config.skillsDir);
      const results: SearchResult[] = [];

      for (const entry of entries) {
        const skillPath = join(config.skillsDir, entry);
        try {
          const raw = await readFile(join(skillPath, "skill.md"), "utf-8");
          const frontmatter = raw.match(/^---\s*\n(.*?)\n---\s*\n/s);
          if (!frontmatter) continue;

          const meta = this.parseFrontmatter(frontmatter[1]);
          const score = matchScore(terms, meta.name ?? entry, meta.description ?? "");

          if (score > 0) {
            results.push({
              title: meta.name ?? entry,
              snippet: (meta.description ?? "").slice(0, 200),
              score,
              source: "skill",
            });
          }
        } catch {
          continue;
        }
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (err) {
      logger.warn({ err }, "Skill search failed");
      return [];
    }
  }

  private parseFrontmatter(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const idx = line.indexOf(":");
      if (idx > 0) {
        out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
    }
    return out;
  }
}
