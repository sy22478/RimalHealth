/**
 * No-PHI-in-Console Tests (Static Analysis)
 *
 * Scans all API route files for console.log / console.error calls that
 * directly reference PHI variable names. This is a static analysis check,
 * NOT runtime interception.
 *
 * HIPAA Requirement: PHI must never be logged to console or files.
 *
 * Covers TASK 2.10.3
 *
 * @module tests/unit/no-phi-in-console
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ============================================================================
// Configuration
// ============================================================================

const API_DIR = path.resolve(__dirname, '../../app/api');

/**
 * PHI variable names that must NEVER appear directly in console.log/error.
 * These are common variable names used across the codebase for PHI data.
 */
const PHI_VARIABLE_NAMES = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'dateOfBirth',
  'address',
  'medicalHistory',
  'formData',
  'body',
  'subject',
  'clinicalNotes',
  'ssn',
  'socialSecurityNumber',
  'allergies',
  'currentMedications',
  'insuranceProvider',
  'insuranceMemberId',
  'insuranceGroupNumber',
  'mfaSecret',
  'mfaBackupCodes',
];

/**
 * Patterns that indicate PHI is being logged.
 * Matches console.log(...phiVar...) or console.error(...phiVar...) patterns.
 *
 * We look for console.log/error calls that directly reference a PHI variable,
 * e.g.:
 *   console.log(firstName)
 *   console.error('Error:', email)
 *   console.log(`Name: ${firstName}`)
 *   console.error({ body })
 *   console.log(req.body)
 *
 * We exclude:
 *   - Comments (lines starting with // or *)
 *   - Lines where the PHI name appears only as a key in a non-logging context
 *   - String literals that describe the field name without the value
 *     (e.g., console.error('Missing field: body') is acceptable as "body"
 *      is just a string label, not the variable)
 */

// ============================================================================
// Helpers
// ============================================================================

/**
 * Recursively collect all .ts files under a directory.
 */
function collectTSFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTSFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Extract console.log and console.error calls from source code,
 * handling multi-line calls.
 *
 * Returns an array of { line: number, text: string } for each call.
 */
function extractConsoleCalls(
  source: string
): Array<{ lineNumber: number; text: string }> {
  const results: Array<{ lineNumber: number; text: string }> = [];
  const lines = source.split('\n');

  let inConsoleCall = false;
  let parenDepth = 0;
  let currentCall = '';
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Skip comment-only lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
      continue;
    }

    if (!inConsoleCall) {
      // Look for console.log or console.error start
      const match = lines[i].match(/console\.(log|error|warn|info|debug)\s*\(/);
      if (match) {
        inConsoleCall = true;
        startLine = i + 1; // 1-indexed
        // Start from the opening paren
        const idx = lines[i].indexOf(match[0]);
        currentCall = lines[i].slice(idx);
        // Count parens
        parenDepth = 0;
        for (const ch of currentCall) {
          if (ch === '(') parenDepth++;
          if (ch === ')') parenDepth--;
        }
        if (parenDepth <= 0) {
          // Single-line call
          results.push({ lineNumber: startLine, text: currentCall });
          inConsoleCall = false;
          currentCall = '';
          parenDepth = 0;
        }
      }
    } else {
      // Continuation of multi-line console call
      currentCall += ' ' + lines[i];
      for (const ch of lines[i]) {
        if (ch === '(') parenDepth++;
        if (ch === ')') parenDepth--;
      }
      if (parenDepth <= 0) {
        results.push({ lineNumber: startLine, text: currentCall });
        inConsoleCall = false;
        currentCall = '';
        parenDepth = 0;
      }
    }
  }

  return results;
}

/**
 * Check if a console call directly references a PHI variable.
 *
 * We look for patterns like:
 *   - Bare variable reference: console.log(firstName)
 *   - Object property: console.log(user.firstName)
 *   - Template literal interpolation: console.log(`${firstName}`)
 *   - Shorthand object: console.log({ firstName })
 *   - Destructured: console.log({ firstName: someVal })
 *   - Bracket access: console.log(data["firstName"])
 *
 * We exclude false positives where the PHI name appears only in a
 * plain string literal like 'firstName is required'.
 */
function findPHIReferences(
  callText: string,
  phiNames: string[]
): string[] {
  const found: string[] = [];

  // Remove the console.xxx( ... ) wrapper, leaving just the arguments
  const argsMatch = callText.match(/console\.\w+\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (!argsMatch) return found;
  const args = argsMatch[1];

  for (const name of phiNames) {
    // Build regex: the PHI variable name used as a variable/property reference
    // (not just inside a string literal describing the field name).
    //
    // Patterns that indicate actual PHI value leakage:
    //   1. Bare or dot-access variable: word boundary + name + word boundary
    //      followed by something that is NOT : (to avoid "firstName: 'label'" misread)
    //      but we DO match `{ firstName }` shorthand, `.firstName`, etc.
    //   2. Template literal: ${...name...}
    //   3. Direct concatenation: + name +

    // Strategy: check if name appears OUTSIDE of string literals.
    // Strip all string literals and template literal text portions, then check.
    const stripped = stripStringLiterals(args);

    // Now check if the PHI variable name appears as a word boundary match
    // in the stripped content (which has string literal content removed).
    const varRegex = new RegExp(`\\b${escapeRegex(name)}\\b`);
    if (varRegex.test(stripped)) {
      found.push(name);
    }
  }

  return found;
}

/**
 * Remove the content of string literals (single-quoted, double-quoted,
 * and backtick template literals) so we only analyze variable references.
 * Template literal expressions (${...}) are kept.
 */
function stripStringLiterals(code: string): string {
  let result = '';
  let i = 0;

  while (i < code.length) {
    const ch = code[i];

    if (ch === "'" || ch === '"') {
      // Skip to closing quote
      const quote = ch;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++; // skip escaped char
        i++;
      }
      i++; // skip closing quote
      result += '""'; // placeholder
    } else if (ch === '`') {
      // Template literal: keep ${...} expressions, strip literal text
      i++; // skip opening backtick
      while (i < code.length && code[i] !== '`') {
        if (code[i] === '\\') {
          i += 2;
        } else if (code[i] === '$' && i + 1 < code.length && code[i + 1] === '{') {
          // Template expression - keep the content
          i += 2; // skip ${
          let braceDepth = 1;
          while (i < code.length && braceDepth > 0) {
            if (code[i] === '{') braceDepth++;
            if (code[i] === '}') braceDepth--;
            if (braceDepth > 0) {
              result += code[i];
            }
            i++;
          }
        } else {
          i++;
        }
      }
      i++; // skip closing backtick
    } else {
      result += ch;
      i++;
    }
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// Tests
// ============================================================================

describe('No PHI in console calls (static analysis)', () => {
  const apiFiles = collectTSFiles(API_DIR);

  it('should find API route files to scan', () => {
    expect(apiFiles.length).toBeGreaterThan(0);
  });

  it('should not have console.log/error calls that directly reference PHI variables', () => {
    const violations: Array<{
      file: string;
      line: number;
      phiVars: string[];
      snippet: string;
    }> = [];

    for (const filePath of apiFiles) {
      const source = fs.readFileSync(filePath, 'utf-8');
      const consoleCalls = extractConsoleCalls(source);

      for (const call of consoleCalls) {
        const phiRefs = findPHIReferences(call.text, PHI_VARIABLE_NAMES);
        if (phiRefs.length > 0) {
          const relativePath = path.relative(
            path.resolve(__dirname, '../..'),
            filePath
          );
          violations.push({
            file: relativePath,
            line: call.lineNumber,
            phiVars: phiRefs,
            snippet: call.text.slice(0, 200),
          });
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line} references PHI vars: [${v.phiVars.join(', ')}]\n    ${v.snippet}`
        )
        .join('\n');

      expect.fail(
        `Found ${violations.length} console call(s) referencing PHI variables:\n${report}`
      );
    }
  });

  it('should detect PHI in template literal interpolations', () => {
    // Unit test for the detection logic itself
    const call = 'console.log(`User email: ${email} logged in`)';
    const refs = findPHIReferences(call, PHI_VARIABLE_NAMES);
    expect(refs).toContain('email');
  });

  it('should detect PHI in object shorthand logging', () => {
    const call = 'console.error({ firstName, lastName, error })';
    const refs = findPHIReferences(call, PHI_VARIABLE_NAMES);
    expect(refs).toContain('firstName');
    expect(refs).toContain('lastName');
  });

  it('should detect PHI in dot-access logging', () => {
    const call = 'console.log(patient.dateOfBirth)';
    const refs = findPHIReferences(call, PHI_VARIABLE_NAMES);
    expect(refs).toContain('dateOfBirth');
  });

  it('should NOT flag string-literal-only references', () => {
    // The word "email" appears only inside a string literal
    const call = "console.error('email field is required')";
    const refs = findPHIReferences(call, PHI_VARIABLE_NAMES);
    expect(refs).not.toContain('email');
  });

  it('should NOT flag references in purely descriptive strings', () => {
    const call = 'console.error("Missing firstName in request")';
    const refs = findPHIReferences(call, PHI_VARIABLE_NAMES);
    expect(refs).not.toContain('firstName');
  });

  it('should detect PHI variable after string concatenation', () => {
    const call = 'console.log("Error: " + firstName)';
    const refs = findPHIReferences(call, PHI_VARIABLE_NAMES);
    expect(refs).toContain('firstName');
  });
});
