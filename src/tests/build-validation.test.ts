import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { resolve } from 'path';

/**
 * Property 3: Invariante de build
 * The compiled JavaScript bundle must never contain Supabase URLs or publishable
 * keys as literal strings — verifiable by text search on the build output.
 *
 * **Validates: Requirements 1.3, 9.1, 9.5**
 *
 * This test runs `vite build` and then searches the `dist/` directory for any
 * occurrence of Supabase credentials that would indicate build-time embedding.
 */

const projectRoot = resolve(__dirname, '../..');
const distDir = join(projectRoot, 'dist');

/**
 * Recursively get all files in a directory
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get only JS/HTML files from dist (where credentials could be embedded)
 */
function getBundleFiles(dir: string): string[] {
  return getAllFiles(dir).filter((file) =>
    /\.(js|mjs|cjs|html|json)$/.test(file)
  );
}

describe('Property 3: Invariante de build (no credentials in bundle)', () => {
  // Run vite build before all tests in this suite
  // This may take a few seconds, so we use a generous timeout
  it('vite build completes successfully', { timeout: 60_000 }, () => {
    execSync('npx vite build', {
      cwd: projectRoot,
      stdio: 'pipe',
      env: {
        ...process.env,
        // Ensure no VITE_SUPABASE_* vars are set during build
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_PROJECT_ID: undefined,
        VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      },
    });
  });

  it('bundle does not contain hardcoded supabase.co URLs', () => {
    const files = getBundleFiles(distDir);
    const matches: Array<{ file: string; line: string }> = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Match patterns like: https://something.supabase.co
        // but ignore comments or source map references
        if (/[a-z0-9-]+\.supabase\.co/.test(line)) {
          matches.push({ file: file.replace(projectRoot, ''), line: line.slice(0, 200) });
        }
      }
    }

    expect(
      matches,
      `Found hardcoded supabase.co URLs in bundle:\n${matches.map((m) => `  ${m.file}: ${m.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('bundle does not contain VITE_SUPABASE environment variable references', () => {
    const files = getBundleFiles(distDir);
    const matches: Array<{ file: string; line: string }> = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Match patterns that would indicate build-time env var embedding
        if (/VITE_SUPABASE/.test(line)) {
          matches.push({ file: file.replace(projectRoot, ''), line: line.slice(0, 200) });
        }
      }
    }

    expect(
      matches,
      `Found VITE_SUPABASE references in bundle:\n${matches.map((m) => `  ${m.file}: ${m.line}`).join('\n')}`
    ).toHaveLength(0);
  });

  it('bundle does not contain Supabase publishable key patterns', () => {
    const files = getBundleFiles(distDir);
    const matches: Array<{ file: string; line: string }> = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Match common Supabase anon key patterns (eyJ... base64 JWT format)
        // Supabase anon keys are typically long base64 strings starting with eyJ
        if (/eyJ[A-Za-z0-9_-]{30,}\.eyJ[A-Za-z0-9_-]{30,}/.test(line)) {
          matches.push({ file: file.replace(projectRoot, ''), line: line.slice(0, 200) });
        }
      }
    }

    expect(
      matches,
      `Found Supabase key patterns in bundle:\n${matches.map((m) => `  ${m.file}: ${m.line}`).join('\n')}`
    ).toHaveLength(0);
  });
});
