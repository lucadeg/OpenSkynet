/**
 * Vision + DOM Fusion
 *
 * Combines screenshot vision with compact DOM representation
 * for best-of-both-worlds understanding
 *
 * @module browser/perception/fusion
 */

import type { Page } from 'playwright';
import { AccessibilityTreeExtractor, PageState } from './ax-extractor';
import { createLogger } from '../../core/logging';

const logger = createLogger('vision-dom-fusion');

// ============================================================================
// Type Definitions
// ============================================================================

export interface ScreenshotData {
  data: string;        // Base64 encoded
  format: 'png' | 'jpeg';
  width: number;
  height: number;
  timestamp: number;
}

export interface FusionState {
  // Vision component
  screenshot: ScreenshotData;

  // DOM component
  dom: {
    state: PageState;
    formatted: string;  // Compact text representation
    json: string;        // Full JSON for complex queries
  };

  // Fusion metadata
  fusion: {
    strategy: 'vision-primary' | 'dom-primary' | 'balanced';
    confidence: number;
    detectedChanges: string[];
    tokenEstimate: {
      dom: number;
      vision: number;
      total: number;
    };
  };
}

export type FusionStrategy = 'vision-primary' | 'dom-primary' | 'balanced';

export interface FusionOptions {
  includeScreenshot?: boolean;
  screenshotQuality?: 'low' | 'high' | 'auto';
  fusionStrategy?: FusionStrategy;
}

// ============================================================================
// Vision + DOM Fusion
// ============================================================================

export class VisionDOMFusion {
  private axExtractor: AccessibilityTreeExtractor;
  private lastScreenshot?: string;
  private lastState?: PageState;

  constructor() {
    this.axExtractor = new AccessibilityTreeExtractor();
  }

  /**
   * Capture fused state - vision + DOM together
   */
  async captureFusedState(
    page: Page,
    options: FusionOptions = {}
  ): Promise<FusionState> {
    const {
      includeScreenshot = true,
      screenshotQuality = 'auto',
      fusionStrategy = 'balanced'
    } = options;

    // Capture DOM state
    const domState = await this.axExtractor.extractInteractiveElements(page);
    this.lastState = domState;

    // Detect changes from last state
    const detectedChanges = this.detectChanges(this.lastState, domState);

    // Capture screenshot if requested
    let screenshot: ScreenshotData;
    if (includeScreenshot) {
      screenshot = await this.captureScreenshot(page, screenshotQuality);
      this.lastScreenshot = screenshot.data;
    } else {
      screenshot = {
        data: '',
        format: 'png',
        width: 0,
        height: 0,
        timestamp: Date.now()
      };
    }

    // Format DOM for LLM
    const formatted = this.axExtractor.formatForLLM(domState);
    const json = this.axExtractor.toJSON(domState);

    // Calculate token estimates
    const domTokens = this.axExtractor.estimateTokenCount(domState);
    const visionTokens = includeScreenshot ? 1000 : 0; // Rough estimate for vision

    // Calculate confidence based on fusion strategy
    const confidence = this.calculateFusionConfidence(
      domState,
      screenshot,
      fusionStrategy
    );

    return {
      screenshot,
      dom: {
        state: domState,
        formatted,
        json
      },
      fusion: {
        strategy: fusionStrategy,
        confidence,
        detectedChanges,
        tokenEstimate: {
          dom: domTokens,
          vision: visionTokens,
          total: domTokens + visionTokens
        }
      }
    };
  }

  /**
   * Build LLM message from fused state
   */
  buildLLMMessage(
    fusedState: FusionState,
    task: string,
    memory: string
  ): Array<{ role: string; content: string | Array<{ type: string; [key: string]: any }> }> {
    const messageParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

    // Task context
    let textContent = `<user_request>\n${task}\n</user_request>\n\n`;
    textContent += `<agent_memory>\n${memory || '(no memory yet)'}\n</agent_memory>\n\n`;

    // Page state from DOM
    textContent += `<page_state>\n`;
    textContent += `URL: ${fusedState.dom.state.url}\n`;
    textContent += `Title: ${fusedState.dom.state.title}\n`;
    textContent += `Elements: ${fusedState.dom.state.stats.interactiveElements} interactive`;

    if (fusedState.dom.state.stats.newElements > 0) {
      textContent += `, ${fusedState.dom.state.stats.newElements} new`;
    }
    textContent += `\n\n`;

    // Scroll position
    const si = fusedState.dom.state.stats.scrollInfo;
    if (!si.isAtBottom) {
      textContent += `Scroll: ${Math.round(si.scrollPercentage)}% of page - more content below\n\n`;
    }

    // DOM elements (compact format)
    textContent += `<interactive_elements>\n${fusedState.dom.formatted}\n</interactive_elements>\n`;
    textContent += `</page_state>\n`;

    // Detected changes
    if (fusedState.fusion.detectedChanges.length > 0) {
      textContent += `\n<detected_changes>\n`;
      textContent += fusedState.fusion.detectedChanges.join('\n');
      textContent += `\n</detected_changes>\n`;
    }

    // Token info (for debugging)
    if (fusedState.fusion.tokenEstimate.total > 0) {
      textContent += `\n<!-- Estimated tokens: DOM=${fusedState.fusion.tokenEstimate.dom}, Vision=${fusedState.fusion.tokenEstimate.vision}, Total=${fusedState.fusion.tokenEstimate.total} -->\n`;
    }

    messageParts.push({ type: 'text', text: textContent });

    // Add screenshot if available
    if (fusedState.screenshot.data.length > 100) {
      messageParts.push({
        type: 'image_url',
        image_url: {
          url: `data:image/${fusedState.screenshot.format};base64,${fusedState.screenshot.data}`,
          detail: fusedState.fusion.strategy === 'vision-primary' ? 'high' : 'auto'
        }
      });
    }

    return [{
      role: 'user',
      content: messageParts.length === 1 ? messageParts[0].text! : messageParts
    }];
  }

  /**
   * Detect changes between page states
   */
  private detectChanges(
    previous: PageState | undefined,
    current: PageState
  ): string[] {
    if (!previous) return [];

    const changes: string[] = [];

    // URL change
    if (previous.url !== current.url) {
      changes.push(`[NAVIGATION] Navigated to: ${current.url}`);
    }

    // Title change
    if (previous.title !== current.title) {
      changes.push(`[PAGE] Title changed to: "${current.title}"`);
    }

    // New elements
    const newElements = current.elements.filter(e => e.isNew);
    if (newElements.length > 0) {
      changes.push(`[ELEMENTS] ${newElements.length} new elements appeared`);

      // List notable new elements
      const notable = newElements
        .filter(e => e.metadata.isInteractable && e.text)
        .slice(0, 5);

      for (const el of notable) {
        changes.push(`  - [${el.refId}]<${el.role}> "${el.text?.slice(0, 30)}"`);
      }
    }

    // Scroll position change
    const prevScroll = previous.stats.scrollInfo.scrollPercentage;
    const currScroll = current.stats.scrollInfo.scrollPercentage;
    if (Math.abs(prevScroll - currScroll) > 10) {
      changes.push(`[SCROLL] Position changed from ${Math.round(prevScroll)}% to ${Math.round(currScroll)}%`);
    }

    // Element count change (significant changes only)
    const countDiff = current.stats.interactiveElements - previous.stats.interactiveElements;
    if (Math.abs(countDiff) > 5) {
      changes.push(`[ELEMENTS] Interactive element count changed by ${countDiff}`);
    }

    return changes;
  }

  /**
   * Capture screenshot with quality settings
   */
  private async captureScreenshot(
    page: Page,
    quality: 'low' | 'high' | 'auto'
  ): Promise<ScreenshotData> {
    try {
      const viewportSize = page.viewportSize();

      // Adjust quality settings
      const screenshotOptions: any = {
        type: 'png',
        fullPage: false  // Only viewport
      };

      // For low quality, we could use JPEG with lower quality
      // But Playwright doesn't support JPEG quality directly
      // We'll use PNG for all for now

      const buffer = await page.screenshot(screenshotOptions);

      return {
        data: buffer.toString('base64'),
        format: 'png',
        width: viewportSize?.width || 1280,
        height: viewportSize?.height || 720,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error({ err: error as Error }, 'Failed to capture screenshot');
      return {
        data: '',
        format: 'png',
        width: 0,
        height: 0,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calculate fusion confidence based on strategy
   */
  private calculateFusionConfidence(
    domState: PageState,
    screenshot: ScreenshotData,
    strategy: FusionStrategy
  ): number {
    // Base confidence
    let confidence = 0.8;

    // Adjust based on DOM completeness
    const domCompleteness = Math.min(1, domState.stats.interactiveElements / 50);
    confidence *= (0.5 + domCompleteness * 0.5);

    // Adjust based on strategy
    switch (strategy) {
      case 'vision-primary':
        confidence *= screenshot.data.length > 100 ? 1.0 : 0.5;
        break;
      case 'dom-primary':
        confidence *= 0.9; // DOM is usually reliable
        break;
      case 'balanced':
        confidence *= 0.85; // Slight penalty for fusion complexity
        break;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get last captured state (for caching)
   */
  getLastState(): PageState | undefined {
    return this.lastState;
  }

  /**
   * Get last screenshot (for caching)
   */
  getLastScreenshot(): string | undefined {
    return this.lastScreenshot;
  }

  /**
   * Reset state
   */
  reset(): void {
    this.axExtractor.reset();
    this.lastScreenshot = undefined;
    this.lastState = undefined;
    logger.info('Vision-DOM Fusion state reset');
  }

  /**
   * Get fusion statistics
   */
  getStats(): {
    refIdCount: number;
    hasScreenshot: boolean;
    hasState: boolean;
  } {
    return {
      refIdCount: this.axExtractor.getRefIdCount(),
      hasScreenshot: !!this.lastScreenshot,
      hasState: !!this.lastState
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const fusion = new VisionDOMFusion();
