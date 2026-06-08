/**
 * State Capture Module
 * Handles browser state capture (snapshot + screenshot) for agent vision
 */

import type { BrowserController } from '../../browser/controller';
import { setLatestScreenshot } from '../../api/routes/browser';

export interface CapturedState {
  output: string;
  screenshot: string | null;
  url: string;
  title: string;
}

export interface StateCaptureOptions {
  useVision: boolean;
  includeElements?: boolean;
}

/**
 * Capture current browser state: snapshot + screenshot → vision-enhanced message
 */
export async function captureState(
  ctrl: BrowserController,
  options: StateCaptureOptions
): Promise<CapturedState> {
  const { useVision } = options;

  if (!ctrl) {
    throw new Error('BrowserController not available');
  }

  try {
    const snapshot = await ctrl.snapshot();
    const stateOutput = snapshot.output || snapshot.elements.map(
      (el) => `[${el.refId}]<${el.tag}>${el.text ? ' ' + JSON.stringify(el.text.slice(0, 100)) : ''}`
    ).join('\n');

    let screenshot: string | null = null;

    if (useVision) {
      screenshot = await ctrl.screenshot();
    }

    // Store screenshot for UI updates
    if (screenshot && screenshot.length > 100) {
      setLatestScreenshot(screenshot, snapshot.url);
    }

    return {
      output: stateOutput,
      screenshot,
      url: snapshot.url,
      title: snapshot.title
    };
  } catch (error) {
    console.error('[StateCapture] Failed to capture state:', error);
    throw error;
  }
}

/**
 * Capture snapshot only (no screenshot)
 */
export async function captureSnapshotOnly(ctrl: BrowserController): Promise<CapturedState> {
  if (!ctrl) {
    throw new Error('BrowserController not available');
  }

  try {
    const snapshot = await ctrl.snapshot();
    const stateOutput = snapshot.output || snapshot.elements.map(
      (el) => `[${el.refId}]<${el.tag}>${el.text ? ' ' + JSON.stringify(el.text.slice(0, 100)) : ''}`
    ).join('\n');

    return {
      output: stateOutput,
      screenshot: null,
      url: snapshot.url,
      title: snapshot.title
    };
  } catch (error) {
    console.error('[StateCapture] Failed to capture snapshot:', error);
    throw error;
  }
}

/**
 * Capture screenshot only (no snapshot)
 */
export async function captureScreenshotOnly(ctrl: BrowserController): Promise<string | null> {
  if (!ctrl) {
    throw new Error('BrowserController not available');
  }

  try {
    const screenshot = await ctrl.screenshot();
    if (screenshot && screenshot.length > 100) {
      const url = ctrl.getSession()?.context?.pages()[0]?.url() || '';
      setLatestScreenshot(screenshot, url);
      return screenshot;
    }
    return null;
  } catch (error) {
    console.error('[StateCapture] Failed to capture screenshot:', error);
    throw error;
  }
}
