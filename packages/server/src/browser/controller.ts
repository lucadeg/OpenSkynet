import type { Page } from "playwright";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfig } from "../core/config";
import logger from "../core/logging";
import { BrowserSession } from "./session";

export interface ElementInfo {
  refId: number;
  tag: string;
  text: string;
  role: string;
  placeholder: string;
  href: string;
  src: string;
  alt: string;
  type: string;
  value: string;
  ariaLabel: string;
  title: string;
  isVisible: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PageSnapshot {
  url: string;
  title: string;
  elements: ElementInfo[];
  textPreview: string;
  scrollPosition?: { x: number; y: number };
}

export interface BrowserActionResult {
  success: boolean;
  message: string;
  retryable?: boolean;
}

const DISMISS_OVERLAYS_JS = `
(() => {
  const selectors = [
    '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]',
    '[class*="notice"]', '[class*="banner"]', '[class*="popup"]',
    '[class*="overlay"]', '[class*="modal"]', '[id*="cookie"]',
    '[id*="consent"]', '[id*="gdpr"]', '[id*="notice"]',
    '[aria-label*="cookie"]', '[aria-label*="consent"]',
    '[aria-label*="accept"]', '[aria-label*="close"]',
    '[aria-label*="dismiss"]', '[aria-label*="Close"]',
    '[aria-label*="Dismiss"]',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (el.offsetHeight === 0) continue;
      const btn = el.querySelector('button, [role="button"], a');
      if (btn && btn.textContent) {
        const txt = btn.textContent.toLowerCase();
        if (txt.includes('accept') || txt.includes('agree') || txt.includes('ok') || txt.includes('close') || txt.includes('dismiss') || txt.includes('got it')) {
          btn.click();
          return;
        }
      }
    }
  }
})();
`;

const SNAPSHOT_JS = `
(() => {
  const MAX = 120;
  let counter = 0;

  const interactiveTags = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'details', 'summary',
    'option', 'optgroup', 'fieldset', 'label', 'output',
  ]);
  const interactiveRoles = new Set([
    'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
    'menuitem', 'tab', 'switch', 'slider', 'spinbutton', 'searchbox',
    'treeitem', 'option', 'menuitemcheckbox', 'menuitemradio',
  ]);
  const contentTags = new Set([
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'p', 'li', 'td', 'th',
  ]);

  function isInteractive(el) {
    if (interactiveTags.has(el.tagName.toLowerCase())) return true;
    const role = el.getAttribute('role');
    if (role && interactiveRoles.has(role.toLowerCase())) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && tabindex !== '-1') return true;
    if (el.tagName.toLowerCase() === 'div' && el.getAttribute('onclick')) return true;
    return false;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  }

  function truncate(s, max) {
    if (!s) return '';
    s = s.replace(/\\s+/g, ' ').trim();
    return s.length > max ? s.slice(0, max) + '...' : s;
  }

  function extractInfo(el) {
    const rect = el.getBoundingClientRect();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const inViewport = rect.top < vpH && rect.bottom > 0 && rect.left < vpW && rect.right > 0;
    return {
      tag: el.tagName.toLowerCase(),
      text: truncate(el.innerText || el.textContent || '', 200),
      role: el.getAttribute('role') || '',
      placeholder: el.getAttribute('placeholder') || '',
      href: el.getAttribute('href') || '',
      src: el.getAttribute('src') || '',
      alt: el.getAttribute('alt') || '',
      type: el.getAttribute('type') || '',
      value: el.value || el.getAttribute('value') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      isVisible: isVisible(el),
      boundingBox: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    };
  }

  const elements = [];

  document.querySelectorAll('[data-sediman-ref-id]').forEach(el => {
    el.removeAttribute('data-sediman-ref-id');
  });

  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walk.nextNode()) && elements.length < MAX) {
    const el = node;
    const tag = el.tagName.toLowerCase();
    const isInter = isInteractive(el);
    const isContent = contentTags.has(tag);
    if (!isInter && !isContent) continue;
    if (!isVisible(el)) continue;

    const refId = counter++;
    el.setAttribute('data-sediman-ref-id', String(refId));
    elements.push({ refId, ...extractInfo(el) });
  }

  const scrollEl = document.scrollingElement || document.documentElement;
  return {
    elements,
    scrollPosition: {
      x: Math.round(scrollEl.scrollLeft || 0),
      y: Math.round(scrollEl.scrollTop || 0),
    },
  };
})();
`;

export class BrowserController {
  private _session: BrowserSession;
  private _pageProvider: (() => Page | null) | null = null;
  private _onStep?: (action: string, detail: string) => void;
  private _checkpoints: Array<{
    url: string;
    scrollX: number;
    scrollY: number;
  }> = [];

  constructor(opts?: {
    headless?: boolean;
    userDataDir?: string;
    onStep?: (action: string, detail: string) => void;
  }) {
    this._session = new BrowserSession({
      headless: opts?.headless,
      userDataDir: opts?.userDataDir,
    });
    this._onStep = opts?.onStep;
  }

  setPageProvider(provider: () => Page | null): void {
    this._pageProvider = provider;
  }

  private _page(): Page {
    const page = this._pageProvider
      ? this._pageProvider()
      : this._session.context?.pages()[0] ?? null;
    if (!page) throw new Error("no active page");
    return page;
  }

  private _emit(action: string, detail: string): void {
    this._onStep?.(action, detail);
  }

  async start(): Promise<void> {
    await this._session.start();
  }

  async stop(): Promise<void> {
    await this._session.stop();
  }

  async navigate(url: string): Promise<string> {
    try {
      const page = this._page();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      this._emit("navigate", url);
      return `Navigated to ${url}`;
    } catch (e: any) {
      return `Failed to navigate to ${url}: ${e.message}`;
    }
  }

  async click(refId: number): Promise<string> {
    try {
      const page = this._page();
      const el = await this._resolveElement(page, refId);
      if (!el) return `Element with refId ${refId} not found`;
      await el.click({ timeout: 5000 });
      this._emit("click", `refId=${refId}`);
      return `Clicked element ${refId}`;
    } catch (e: any) {
      return `Failed to click element ${refId}: ${e.message}`;
    }
  }

  async typeText(
    refId: number,
    text: string,
    submit?: boolean,
  ): Promise<string> {
    try {
      const page = this._page();
      const el = await this._resolveElement(page, refId);
      if (!el) return `Element with refId ${refId} not found`;
      await el.fill("");
      await el.type(text, { delay: 30 });
      if (submit) {
        await el.press("Enter");
      }
      this._emit("type", `refId=${refId} text=${text.slice(0, 50)}`);
      return `Typed "${text.slice(0, 50)}" into element ${refId}${submit ? " and submitted" : ""}`;
    } catch (e: any) {
      return `Failed to type into element ${refId}: ${e.message}`;
    }
  }

  async hover(refId: number): Promise<string> {
    try {
      const page = this._page();
      const el = await this._resolveElement(page, refId);
      if (!el) return `Element with refId ${refId} not found`;
      await el.hover({ timeout: 5000 });
      this._emit("hover", `refId=${refId}`);
      return `Hovered over element ${refId}`;
    } catch (e: any) {
      return `Failed to hover over element ${refId}: ${e.message}`;
    }
  }

  async selectOption(refId: number, value: string): Promise<string> {
    try {
      const page = this._page();
      const el = await this._resolveElement(page, refId);
      if (!el) return `Element with refId ${refId} not found`;
      await el.selectOption(value, { timeout: 5000 });
      this._emit("select", `refId=${refId} value=${value}`);
      return `Selected "${value}" in element ${refId}`;
    } catch (e: any) {
      return `Failed to select in element ${refId}: ${e.message}`;
    }
  }

  async scroll(direction: string, amount?: number): Promise<string> {
    try {
      const page = this._page();
      const delta = amount ?? 500;
      const deltaWithSign = direction === "up" ? -delta : delta;
      if (direction === "left" || direction === "right") {
        await page.mouse.wheel(direction === "right" ? delta : -delta, 0);
      } else {
        await page.mouse.wheel(0, deltaWithSign);
      }
      this._emit("scroll", `${direction} ${amount ?? 500}px`);
      return `Scrolled ${direction} by ${amount ?? 500}px`;
    } catch (e: any) {
      return `Failed to scroll: ${e.message}`;
    }
  }

  async pressKey(key: string): Promise<string> {
    try {
      const page = this._page();
      await page.keyboard.press(key);
      this._emit("press_key", key);
      return `Pressed key: ${key}`;
    } catch (e: any) {
      return `Failed to press key ${key}: ${e.message}`;
    }
  }

  async goBack(): Promise<string> {
    try {
      const page = this._page();
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
      this._emit("go_back", "");
      return "Navigated back";
    } catch (e: any) {
      return `Failed to go back: ${e.message}`;
    }
  }

  async goForward(): Promise<string> {
    try {
      const page = this._page();
      await page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 });
      this._emit("go_forward", "");
      return "Navigated forward";
    } catch (e: any) {
      return `Failed to go forward: ${e.message}`;
    }
  }

  async refresh(): Promise<string> {
    try {
      const page = this._page();
      await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
      this._emit("refresh", "");
      return "Page refreshed";
    } catch (e: any) {
      return `Failed to refresh: ${e.message}`;
    }
  }

  async switchTab(index: number): Promise<string> {
    try {
      const ctx = this._session.context;
      if (!ctx) return "No browser context";
      const pages = ctx.pages();
      if (index < 0 || index >= pages.length) {
        return `Tab index ${index} out of range (0-${pages.length - 1})`;
      }
      await pages[index].bringToFront();
      this._emit("switch_tab", `index=${index}`);
      return `Switched to tab ${index}: ${pages[index].url()}`;
    } catch (e: any) {
      return `Failed to switch tab: ${e.message}`;
    }
  }

  async listTabs(): Promise<string> {
    try {
      const ctx = this._session.context;
      if (!ctx) return "No browser context";
      const pages = ctx.pages();
      const lines = pages.map(
        (p, i) => `[${i}] ${p.url()} — ${p.title()}`,
      );
      this._emit("list_tabs", `${pages.length} tabs`);
      return lines.join("\n") || "No open tabs";
    } catch (e: any) {
      return `Failed to list tabs: ${e.message}`;
    }
  }

  async snapshot(): Promise<PageSnapshot> {
    const page = this._page();
    await page.evaluate(DISMISS_OVERLAYS_JS).catch(() => {});
    const result = (await page.evaluate(SNAPSHOT_JS)) as {
      elements: ElementInfo[];
      scrollPosition: { x: number; y: number };
    };
    const url = page.url();
    const title = await page.title();

    let textPreview = "";
    try {
      textPreview = await page.evaluate(() => {
        const body = document.body;
        if (!body) return "";
        const clone = body.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll("script, style, noscript, svg, path")
          .forEach((el) => el.remove());
        return (clone.innerText || "").replace(/\s+/g, " ").trim().slice(0, 3000);
      });
    } catch {
      // ignore
    }

    this._emit("snapshot", `${result.elements.length} elements`);

    return {
      url,
      title,
      elements: result.elements,
      textPreview,
      scrollPosition: result.scrollPosition,
    };
  }

  async extractText(): Promise<string> {
    try {
      const page = this._page();
      const text = await page.evaluate(() => {
        const body = document.body;
        if (!body) return "";
        const clone = body.cloneNode(true) as HTMLElement;
        clone
          .querySelectorAll("script, style, noscript, svg, path")
          .forEach((el) => el.remove());
        return (clone.innerText || "").replace(/\s+/g, " ").trim();
      });
      const cfg = getConfig();
      return text.slice(0, cfg.defaultWebMaxChars);
    } catch (e: any) {
      return `Failed to extract text: ${e.message}`;
    }
  }

  async extractBySelector(selector: string): Promise<string> {
    try {
      const page = this._page();
      const el = page.locator(selector).first();
      const text = await el.innerText({ timeout: 5000 });
      return text.trim();
    } catch (e: any) {
      return `Failed to extract by selector "${selector}": ${e.message}`;
    }
  }

  async waitForSelector(
    selector: string,
    timeout?: number,
  ): Promise<string> {
    try {
      const page = this._page();
      await page.waitForSelector(selector, {
        timeout: timeout ?? 10000,
        state: "visible",
      });
      return `Element "${selector}" appeared`;
    } catch (e: any) {
      return `Timeout waiting for "${selector}": ${e.message}`;
    }
  }

  async screenshot(): Promise<string | null> {
    return this._session.takeScreenshot();
  }

  async saveCheckpoint(): Promise<number> {
    const page = this._page();
    const scroll = await page.evaluate(() => ({
      x: window.scrollX,
      y: window.scrollY,
    }));
    this._checkpoints.push({
      url: page.url(),
      scrollX: scroll.x,
      scrollY: scroll.y,
    });
    this._emit("save_checkpoint", `index=${this._checkpoints.length - 1}`);
    return this._checkpoints.length - 1;
  }

  async restoreCheckpoint(index?: number): Promise<boolean> {
    if (this._checkpoints.length === 0) return false;
    const idx = index ?? this._checkpoints.length - 1;
    if (idx < 0 || idx >= this._checkpoints.length) return false;
    const cp = this._checkpoints[idx];
    try {
      const page = this._page();
      await page.goto(cp.url, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await page.evaluate(
        ([x, y]) => window.scrollTo(x, y),
        [cp.scrollX, cp.scrollY],
      );
      this._emit("restore_checkpoint", `index=${idx}`);
      return true;
    } catch {
      return false;
    }
  }

  clearCheckpoints(): void {
    this._checkpoints = [];
  }

  async getUrl(): Promise<string> {
    return this._page().url();
  }

  async getTitle(): Promise<string> {
    return this._page().title();
  }

  private async _resolveElement(
    page: Page,
    refId: number,
  ): Promise<import("playwright").Locator | null> {
    const byRef = page.locator(`[data-sediman-ref-id="${refId}"]`).first();
    if ((await byRef.count()) > 0) return byRef;

    const snapshot = await page.evaluate((id) => {
      const all = Array.from(document.querySelectorAll("[data-sediman-ref-id]"));
      for (const el of all) {
        if (el.getAttribute("data-sediman-ref-id") === String(id)) return null;
      }
      return "ref_missing";
    }, refId);

    if (snapshot !== "ref_missing") return null;

    const candidates = await page.evaluate(() => {
      const results: Array<{
        tag: string;
        text: string;
        role: string;
        placeholder: string;
        href: string;
        ariaLabel: string;
      }> = [];
      const interactive = [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "[role]",
        "[tabindex]",
      ];
      for (const sel of interactive) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          results.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || "").slice(0, 100),
            role: el.getAttribute("role") || "",
            placeholder: el.getAttribute("placeholder") || "",
            href: el.getAttribute("href") || "",
            ariaLabel: el.getAttribute("aria-label") || "",
          });
        }
      }
      return results;
    });

    if (refId >= 0 && refId < candidates.length) {
      const info = candidates[refId];
      if (info) {
        if (info.ariaLabel) {
          const loc = page.locator(`[aria-label="${info.ariaLabel}"]`).first();
          if ((await loc.count()) > 0) return loc;
        }
        if (info.href) {
          const loc = page.locator(`a[href="${info.href}"]`).first();
          if ((await loc.count()) > 0) return loc;
        }
        if (info.text) {
          const loc = page
            .getByText(info.text.slice(0, 50), { exact: false })
            .first();
          if ((await loc.count()) > 0) return loc;
        }
        if (info.role) {
          const loc = page.locator(`[role="${info.role}"]`).first();
          if ((await loc.count()) > 0) return loc;
        }
      }
    }

    return null;
  }
}
