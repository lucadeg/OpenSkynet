/**
 * Page Extraction Provider
 *
 * Uses a smaller/faster LLM for DOM extraction to reduce costs and latency
 * The extraction LLM only needs to identify interactive elements on the page
 *
 * @module llm/page-extraction-provider
 */

import type { LLMProvider } from './provider';
import { z } from 'zod';

// ============================================================================
// Page Extraction Schema
// ============================================================================

/**
 * Schema for interactive elements extracted from a page
 */
export const PageElementSchema = z.object({
  refId: z.number().describe('Sequential reference ID starting from 0'),
  tag: z.string().describe('HTML tag name (button, input, a, select, textarea, etc.)'),
  text: z.string().optional().describe('Visible text content'),
  placeholder: z.string().optional().describe('Placeholder text if input'),
  value: z.string().optional().describe('Current value if input'),
  role: z.string().optional().describe('ARIA role if available'),
  ariaLabel: z.string().optional().describe('ARIA label if available'),
  isVisible: z.boolean().default(true).describe('Whether element is in viewport'),
  isInteractable: z.boolean().default(true).describe('Whether element is not disabled'),
});

export type PageElement = z.infer<typeof PageElementSchema>;

/**
 * Schema for complete page extraction result
 */
export const PageExtractionSchema = z.object({
  interactiveElements: z.array(PageElementSchema)
    .describe('List of all interactive elements on the page'),
  pageTitle: z.string().describe('Title of the page'),
  pageUrl: z.string().describe('Current URL of the page'),
  summary: z.string().optional().describe('Brief description of page purpose'),
});

export type PageExtraction = z.infer<typeof PageExtractionSchema>;

// ============================================================================
// Page Extraction Provider
// ============================================================================

export interface PageExtractionOptions {
  /** Maximum number of elements to extract */
  maxElements?: number;
  /** Include hidden elements */
  includeHidden?: boolean;
  /** Extract form values */
  includeValues?: boolean;
}

export class PageExtractionProvider {
  private llmProvider: LLMProvider;
  private extractionPrompt: string;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    this.extractionPrompt = this.buildExtractionPrompt();
  }

  /**
   * Extract structured page data from raw page content
   *
   * @param pageData - Raw page data (HTML, text, URL)
   * @param options - Extraction options
   * @returns Structured page extraction with interactive elements
   */
  async extractPage(
    pageData: {
      html?: string;
      text?: string;
      url?: string;
    },
    options: PageExtractionOptions = {}
  ): Promise<PageExtraction> {
    const {
      maxElements = 100,
      includeHidden = false,
      includeValues = true
    } = options;

    const prompt = this.buildExtractionPrompt({
      url: pageData.url || '',
      text: pageData.text ? pageData.text.slice(0, 15000) : '',
      maxElements,
      includeHidden,
      includeValues,
    });

    try {
      // Try to use structured output if available (Claude 3.5+)
      if ('chatStructured' in this.llmProvider) {
        const provider = this.llmProvider as any;
        const result = await provider.chatStructured(
          [{ role: 'user', content: prompt }],
          PageExtractionSchema,
          'Extract page structure accurately'
        );
        return result.data as PageExtraction;
      }

      // Fallback to regular chat with JSON parsing
      const response = await this.llmProvider.chat(
        [{ role: 'user', content: prompt }],
        [],
        this.extractionPrompt
      );

      // Parse and validate response
      const extracted = this.parseAndValidate(response.text || '');
      return extracted;
    } catch (error) {
      console.error('[PageExtractionProvider] Extraction failed:', error);

      // Return minimal structure on failure
      return {
        interactiveElements: [],
        pageTitle: pageData.url || 'Unknown',
        pageUrl: pageData.url || '',
        summary: 'Extraction failed - using fallback'
      };
    }
  }

  /**
   * Parse and validate LLM response
   */
  private parseAndValidate(text: string): PageExtraction {
    try {
      // Try to extract JSON from response
      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : text.trim();

      const parsed = JSON.parse(jsonString);
      const validated = PageExtractionSchema.parse(parsed);
      return validated;
    } catch (error) {
      console.warn('[PageExtractionProvider] JSON parse/validation failed:', error);

      // Return minimal structure
      return {
        interactiveElements: [],
        pageTitle: 'Parse Error',
        pageUrl: '',
        summary: 'Failed to parse extraction response'
      };
    }
  }

  /**
   * Build the extraction prompt
   */
  private buildExtractionPrompt(options?: {
    url?: string;
    text?: string;
    maxElements?: number;
    includeHidden?: boolean;
    includeValues?: boolean;
  }): string {
    const {
      url = '',
      text = '',
      maxElements = 100,
      includeHidden = false,
      includeValues = true
    } = options || {};

    return `You are a page structure extractor. Your task is to identify ALL interactive elements on the page.

Page URL: ${url || 'Unknown'}

Instructions:
- Extract ONLY interactive elements (buttons, inputs, links, selects, textareas, etc.)
- Assign sequential refIds starting from 0
- Include actual visible text, not placeholder text (unless it's an input with no value)
- Mark elements as isVisible if they're in the viewport
- Mark elements as isInteractable if they're not disabled/readonly

${includeValues ? '- Include current form values when present' : '- Do not include form values'}
${includeHidden ? '- Include hidden elements' : '- Skip hidden elements (display:none, type=hidden)'}

Return a JSON object with this exact structure:
{
  "interactiveElements": [
    {
      "refId": 0,
      "tag": "button",
      "text": "Click Me",
      "placeholder": null,
      "value": null,
      "role": null,
      "ariaLabel": null,
      "isVisible": true,
      "isInteractable": true
    }
  ],
  "pageTitle": "Page Title",
  "pageUrl": "${url}",
  "summary": "Brief description of what this page does"
}

Max elements to extract: ${maxElements}

Page content (text preview):
${text.slice(0, 10000)}${text.length > 10000 ? '\n... (truncated)' : ''}

IMPORTANT:
- Return valid JSON only
- No markdown formatting
- No explanations outside the JSON`;
  }

  /**
   * Extract page elements from Playwright page
   * This is a convenience method for direct page extraction
   */
  async extractFromPlaywrightPage(
    page: any,
    options?: PageExtractionOptions
  ): Promise<PageExtraction> {
    try {
      const url = page.url();
      const title = await page.title();
      const text = await page.evaluate(() => {
        // Get all text content
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script, style, noscript, svg').forEach(el => el.remove());
        return clone.innerText || '';
      });

      return await this.extractPage({ url, text }, options);
    } catch (error) {
      console.error('[PageExtractionProvider] Playwright extraction failed:', error);

      return {
        interactiveElements: [],
        pageTitle: 'Extraction Error',
        pageUrl: '',
        summary: 'Failed to extract from Playwright page'
      };
    }
  }

  /**
   * Format extracted page for LLM consumption
   * Converts the structured extraction to a readable format
   */
  formatForLLM(extraction: PageExtraction): string {
    const lines: string[] = [];

    lines.push(`URL: ${extraction.pageUrl}`);
    lines.push(`Title: ${extraction.pageTitle}`);
    lines.push('');
    lines.push(`Interactive Elements (${extraction.interactiveElements.length} total):`);

    for (const el of extraction.interactiveElements) {
      const parts: string[] = [];
      parts.push(`[${el.refId}]`);
      parts.push(`<${el.tag}>`);

      if (el.text) parts.push(`"${el.text.slice(0, 50)}${el.text.length > 50 ? '...' : ''}"`);
      if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
      if (el.value) parts.push(`value="${el.value}"`);
      if (!el.isVisible) parts.push('(hidden)');
      if (!el.isInteractable) parts.push('(disabled)');

      lines.push(parts.join(' '));
    }

    if (extraction.summary) {
      lines.push('');
      lines.push(`Summary: ${extraction.summary}`);
    }

    return lines.join('\n');
  }

  /**
   * Check if page extraction is available
   */
  isAvailable(): boolean {
    return !!this.llmProvider;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a page extraction provider
 *
 * @param provider - LLM provider to use for extraction
 * @returns Page extraction provider instance
 */
export function createPageExtractionProvider(provider: LLMProvider): PageExtractionProvider {
  return new PageExtractionProvider(provider);
}
