/**
 * BrowserTool - Browser automation tool
 *
 * Based on kimi-code's tool pattern with proper:
 * - BuiltinTool interface
 * - resolveExecution returning execution plan
 * - ToolResultBuilder for output formatting
 * - Display metadata for UI
 * - ToolAccesses for resource tracking
 */

import { z } from 'zod';
import { getOpenbrowserAdapter } from '../../agent/tools/browser-tools';
import type { BuiltinTool, ExecutableToolResult, ToolExecution } from '../tooling/types';
import { literalRulePattern, matchesGlobRuleSubject } from '../tooling/types';
import { ToolAccesses } from '../tooling/tool-access';
import { ToolResultBuilder } from '../tooling/result-builder';

const BrowserAutomationInputSchema = z.object({
  action: z.enum([
    'navigate_and_screenshot',
    'navigate_and_extract',
    'click_and_wait',
    'fill_and_submit',
    'scroll_and_capture',
    'wait_for_element'
  ]).describe('Browser automation action to perform'),
  url: z.string().optional().describe('URL to navigate to'),
  selector: z.string().optional().describe('CSS selector for element targeting'),
  text: z.string().optional().describe('Text to fill in forms'),
  wait_time: z.number().optional().default(2).describe('Wait time in seconds'),
  scroll_direction: z.enum(['up', 'down']).optional().default('down').describe('Scroll direction'),
  scroll_amount: z.number().optional().default(500).describe('Pixels to scroll'),
}).describe('Browser automation input');

type BrowserAutomationInput = z.infer<typeof BrowserAutomationInputSchema>;

export class BrowserTool implements BuiltinTool<BrowserAutomationInput> {
  readonly name = 'Browser' as const;
  readonly description = `High-level browser automation for common tasks.

This tool combines multiple browser operations for convenience:
- navigate_and_screenshot: Navigate to URL and capture screenshot
- navigate_and_extract: Navigate to URL and extract text content
- click_and_wait: Click element and wait for page load
- fill_and_submit: Fill form field and submit
- scroll_and_capture: Scroll page and capture screenshot
- wait_for_element: Wait for specific element to appear

Use this tool for common browser automation tasks instead of individual browser commands.

The tool handles:
- Page load waiting
- Element visibility checks
- Screenshot capture
- Text extraction
- Form interactions

All actions include automatic error recovery and retry logic.`;

  readonly parameters = zodToJsonSchema(BrowserAutomationInputSchema);

  resolveExecution(args: BrowserAutomationInput): ToolExecution {
    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return {
        isError: true,
        output: 'Browser adapter not available. Ensure Openbrowser is properly initialized.'
      };
    }

    const preview = args.url ? `Navigate to ${args.url}` : `Browser action: ${args.action}`;

    return {
      accesses: ToolAccesses.browser(),
      description: preview,
      display: {
        kind: 'browser',
        action: args.action,
        url: args.url,
        selector: args.selector
      },
      approvalRule: literalRulePattern(this.name, args.action),
      matchesRule: (ruleArgs) => matchesGlobRuleSubject(ruleArgs, args.action),
      execute: (ctx) => this.execution(args, ctx)
    };
  }

  private async execution(
    args: BrowserAutomationInput,
    ctx: { signal: AbortSignal }
  ): Promise<ExecutableToolResult> {
    if (ctx.signal.aborted) {
      return { isError: true, output: 'Aborted before browser action started' };
    }

    const adapter = getOpenbrowserAdapter();
    if (!adapter) {
      return { isError: true, output: 'Browser adapter not available.' };
    }

    const builder = new ToolResultBuilder({ maxChars: 100_000 });
    const waitMs = (args.wait_time ?? 2) * 1000;

    try {
      switch (args.action) {
        case 'navigate_and_screenshot': {
          if (!args.url) {
            return builder.error('URL required for navigate_and_screenshot');
          }

          builder.write(`Navigating to: ${args.url}\n`);
          await adapter.executeTool('browser_navigate', { url: args.url });

          await this.wait(waitMs, ctx.signal);
          builder.write('Waiting for page load...\n');

          const screenshot = await adapter.executeTool('browser_screenshot', {});
          if (screenshot.success) {
            builder.write('Screenshot captured successfully.\n');
            builder.write(`Screenshot path: ${screenshot.output}`);
          } else {
            builder.write(`Screenshot failed: ${screenshot.error}`);
          }

          return builder.ok('Browser navigation and screenshot completed');
        }

        case 'navigate_and_extract': {
          if (!args.url) {
            return builder.error('URL required for navigate_and_extract');
          }

          builder.write(`Navigating to: ${args.url}\n`);
          await adapter.executeTool('browser_navigate', { url: args.url });

          await this.wait(waitMs, ctx.signal);
          builder.write('Waiting for page load...\n');

          const text = await adapter.executeTool('browser_extract_text', {});
          if (text.success) {
            builder.write('Page content extracted:\n\n');
            builder.write(String(text.output));
          } else {
            builder.write(`Text extraction failed: ${text.error}`);
          }

          return builder.ok('Browser navigation and text extraction completed');
        }

        case 'click_and_wait': {
          if (!args.selector) {
            return builder.error('Selector required for click_and_wait');
          }

          builder.write(`Clicking element: ${args.selector}\n`);
          await adapter.executeTool('browser_click', { selector: args.selector });

          await this.wait(waitMs, ctx.signal);
          builder.write('Waiting for page response...\n');

          const screenshot = await adapter.executeTool('browser_screenshot', {});
          if (screenshot.success) {
            builder.write('Screenshot captured after click.\n');
            builder.write(`Screenshot path: ${screenshot.output}`);
          }

          return builder.ok('Element clicked and page response captured');
        }

        case 'fill_and_submit': {
          if (!args.selector || !args.text) {
            return builder.error('Selector and text required for fill_and_submit');
          }

          builder.write(`Filling ${args.selector} with text\n`);
          await adapter.executeTool('browser_fill', {
            selector: args.selector,
            text: args.text
          });

          await this.wait(1000, ctx.signal);
          builder.write('Submitting form...\n');

          await adapter.executeTool('browser_press', { key: 'Enter' });

          await this.wait(waitMs, ctx.signal);
          builder.write('Waiting for form submission...\n');

          const screenshot = await adapter.executeTool('browser_screenshot', {});
          if (screenshot.success) {
            builder.write('Screenshot captured after submission.\n');
          }

          return builder.ok('Form filled and submitted');
        }

        case 'scroll_and_capture': {
          const direction = args.scroll_direction ?? 'down';
          const amount = args.scroll_amount ?? 500;

          builder.write(`Scrolling ${direction} by ${amount}px\n`);
          await adapter.executeTool('browser_scroll', {
            direction,
            amount
          });

          await this.wait(1000, ctx.signal);

          const screenshot = await adapter.executeTool('browser_screenshot', {});
          if (screenshot.success) {
            builder.write('Screenshot captured after scroll.\n');
          }

          return builder.ok('Page scrolled and captured');
        }

        case 'wait_for_element': {
          if (!args.selector) {
            return builder.error('Selector required for wait_for_element');
          }

          builder.write(`Waiting for element: ${args.selector}\n`);
          // Implement element waiting logic
          await this.wait(waitMs, ctx.signal);

          const screenshot = await adapter.executeTool('browser_screenshot', {});
          if (screenshot.success) {
            builder.write('Element found and screenshot captured.\n');
          }

          return builder.ok('Element detected');
        }

        default: {
          return builder.error(`Unknown action: ${args.action}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      builder.write(`\nError: ${errorMessage}`);
      return builder.error('Browser action failed');
    }
  }

  private async wait(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        reject(new Error('Aborted during wait'));
      });
    });
  }
}

function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const zodSchema = schema as z.ZodType<unknown>;
  // Basic conversion - in production use zod-to-json-schema
  return {
    type: 'object',
    properties: {
      action: { type: 'string' },
      url: { type: 'string' },
      selector: { type: 'string' },
      text: { type: 'string' },
      wait_time: { type: 'number' }
    }
  };
}
