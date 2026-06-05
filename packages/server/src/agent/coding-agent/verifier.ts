/**
 * Inline code verification for the Coding Agent.
 * Performs syntax checking and basic validation of code edits.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { FileEdit, VerificationResult } from "./types";

const VERIFYABLE_EXTENSIONS = new Set([
  ".py", ".js", ".ts", ".tsx", ".jsx",
  ".rs", ".go", ".rb", ".java",
  ".c", ".cpp", ".h", ".hpp",
  ".cs", ".swift", ".kt",
]);

const SKIP_PATTERNS = [
  "test_", "_test.", "_tests.", ".test.", ".spec.",
  ".generated.", ".bundle.", ".lock",
  "package-lock", "yarn.lock",
];

export class InlineVerifier {
  /**
   * Check if a file should be inline verified.
   */
  shouldVerify(filePath: string): boolean {
    const ext = filePath.split(".").pop();
    if (!ext) return false;

    const hasValidExt = VERIFYABLE_EXTENSIONS.has(`.${ext}`);
    if (!hasValidExt) return false;

    const name = filePath.toLowerCase();
    for (const pattern of SKIP_PATTERNS) {
      if (name.includes(pattern)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verify a file edit by checking syntax.
   */
  async verifyEdit(edit: FileEdit): Promise<VerificationResult> {
    const result: VerificationResult = {
      filePath: edit.path,
      passed: false,
      errors: [],
      warnings: [],
    };

    if (!this.shouldVerify(edit.path)) {
      result.passed = true;
      result.warnings.push("Skipped verification (not a verifyable file type)");
      return result;
    }

    const ext = edit.path.split(".").pop();
    const errors = await this.checkSyntax(edit.newContent, ext || "");

    if (errors.length > 0) {
      result.errors = errors;
      result.passed = false;
    } else {
      result.passed = true;
    }

    return result;
  }

  /**
   * Check syntax of code content.
   */
  private async checkSyntax(content: string, ext: string): Promise<string[]> {
    const errors: string[] = [];

    // Basic syntax checks (would be enhanced with language-specific tools)
    if (ext === "js" || ext === "ts" || ext === "jsx" || ext === "tsx") {
      errors.push(...this.checkJavaScriptSyntax(content));
    } else if (ext === "py") {
      errors.push(...this.checkPythonSyntax(content));
    } else if (ext === "rs") {
      errors.push(...this.checkRustSyntax(content));
    } else if (ext === "go") {
      errors.push(...this.checkGoSyntax(content));
    }

    return errors;
  }

  private checkJavaScriptSyntax(content: string): string[] {
    const errors: string[] = [];

    // Basic bracket matching
    const brackets = this.checkBrackets(content, "()", "[]", "{}");
    if (!brackets.matched) {
      errors.push(`Unmatched brackets: ${brackets.unmatched}`);
    }

    // Check for common syntax errors
    if (content.includes("=>") && !content.includes("(")) {
      // Arrow functions without parentheses might be ok, but check
    }

    return errors;
  }

  private checkPythonSyntax(content: string): string[] {
    const errors: string[] = [];

    // Check indentation consistency
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      if (trimmed.startsWith(":") && i < lines.length - 1) {
        const nextLine = lines[i + 1];
        if (nextLine && !nextLine.startsWith("    ") && !nextLine.trim().length === 0) {
          errors.push(`Line ${i + 2}: Expected indented block after colon`);
        }
      }
    }

    return errors;
  }

  private checkRustSyntax(content: string): string[] {
    const errors: string[] = [];

    // Basic bracket matching
    const brackets = this.checkBrackets(content, "()", "[]", "{}", "<>");
    if (!brackets.matched) {
      errors.push(`Unmatched brackets: ${brackets.unmatched}`);
    }

    return errors;
  }

  private checkGoSyntax(content: string): string[] {
    const errors: string[] = [];

    // Basic bracket matching
    const brackets = this.checkBrackets(content, "()", "[]", "{}");
    if (!brackets.matched) {
      errors.push(`Unmatched brackets: ${brackets.unmatched}`);
    }

    return errors;
  }

  private checkBrackets(content: string, ...pairs: string[]): {
    matched: boolean;
    unmatched: string;
  } {
    const stack: string[] = [];
    const openMap: Record<string, string> = {};
    const closeMap: Record<string, string> = {};

    for (const pair of pairs) {
      if (pair.length >= 2) {
        openMap[pair[0]] = pair[1];
        closeMap[pair[1]] = pair[0];
      }
    }

    for (const char of content) {
      if (openMap[char]) {
        stack.push(char);
      } else if (closeMap[char]) {
        const expected = openMap[closeMap[char]];
        const last = stack.pop();
        if (last !== expected) {
          return { matched: false, unmatched: `Expected ${expected} but got ${last}` };
        }
      }
    }

    if (stack.length > 0) {
      return { matched: false, unmatched: `Unclosed ${stack.join(", ")}` };
    }

    return { matched: true, unmatched: "" };
  }
}

export async function verifyEdits(edits: FileEdit[]): Promise<VerificationResult[]> {
  const verifier = new InlineVerifier();
  const results: VerificationResult[] = [];

  for (const edit of edits) {
    if (verifier.shouldVerify(edit.path)) {
      const result = await verifier.verifyEdit(edit);
      results.push(result);
    }
  }

  return results;
}
