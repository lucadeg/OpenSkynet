import TurndownService from "turndown";
import { getConfig } from "../core/config";
import logger from "../core/logging";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const URL_CACHE_TTL = 300_000;
const URL_CACHE_MAX = 50;

interface CacheEntry {
  title: string;
  content: string;
  timestamp: number;
}

const _urlCache = new Map<string, CacheEntry>();

const _td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

_td.remove(["script", "style", "noscript", "iframe"]);

export interface ExtractResult {
  title: string;
  content: string;
  url: string;
}

export function clearUrlCache(): void {
  _urlCache.clear();
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function stripTags(html: string): string {
  let out = html.replace(/<(script|style|noscript|iframe)[\s>][\s\S]*?<\/\1>/gi, "");
  out = out.replace(/<!--[\s\S]*?-->/g, "");
  return out;
}

function cleanMarkdown(text: string): string {
  text = text.replace(/%[0-9A-Fa-f]{2}/g, "");
  text = text.replace(/\n{4,}/g, "\n\n\n");
  const lines = text.split("\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (
      stripped &&
      (stripped.startsWith("{") || stripped.startsWith("[")) &&
      stripped.length > 200
    ) {
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").trim();
}

export async function httpExtract(
  url: string,
  options?: { timeout?: number; maxChars?: number },
): Promise<ExtractResult> {
  const config = getConfig();
  const timeout = options?.timeout ?? config.defaultHttpTimeout;
  const maxChars = options?.maxChars ?? config.defaultWebMaxChars;

  const cached = _urlCache.get(url);
  if (cached && Date.now() - cached.timestamp < URL_CACHE_TTL) {
    let content = cached.content;
    if (content.length > maxChars) {
      content = content.slice(0, maxChars) + "\n\n... (truncated)";
    }
    return { title: cached.title, content, url };
  }

  if (_urlCache.size >= URL_CACHE_MAX) {
    let oldestKey = "";
    let oldestTs = Infinity;
    for (const [k, v] of _urlCache) {
      if (v.timestamp < oldestTs) {
        oldestTs = v.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) _urlCache.delete(oldestKey);
  }

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout * 1000);
      response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": USER_AGENT },
      });
      clearTimeout(timer);

      if (!response.ok) {
        const status = response.status;
        if ((status === 429 || status >= 502) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          lastError = new Error(`HTTP ${status}`);
          continue;
        }
        throw new Error(`HTTP ${status}: ${response.statusText}`);
      }

      break;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      throw lastError;
    }
  }

  if (!response) throw lastError ?? new Error("No response");

  const html = await response.text();
  const title = extractTitle(html);
  const cleaned = stripTags(html);
  let markdown = _td.turndown(cleaned);
  markdown = cleanMarkdown(markdown);

  if (title && !markdown.startsWith(`# ${title}`)) {
    markdown = `# ${title}\n\n${markdown}`;
  }

  _urlCache.set(url, { title, content: markdown, timestamp: Date.now() });

  let content = markdown;
  if (content.length > maxChars) {
    content = content.slice(0, maxChars) + "\n\n... (truncated)";
  }

  return { title, content, url };
}

export async function browserExtract(
  _url: string,
  _browserSession?: unknown,
): Promise<ExtractResult> {
  logger.info("browser_extract_stub");
  return { title: "", content: "", url: _url };
}
