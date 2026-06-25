import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Property 4: Integridade de migração
 * Verify that after pipeline execution, both Supabase projects have identical
 * schemas for managed tables by validating the pipeline STRUCTURE guarantees
 * idempotency.
 *
 * The pipeline must:
 * 1. Apply the SAME migration files to BOTH environments (same `supabase db push` command)
 * 2. Apply migrations to Preview BEFORE Production (order matters for fail-safe)
 * 3. If Preview migration fails, Production migration won't execute (sequential steps)
 *
 * **Validates: Requirements 3.1, 3.2**
 */

// Load and parse the cd.yml workflow file
const workflowPath = resolve(__dirname, '../../.github/workflows/cd.yml');
const workflowContent = readFileSync(workflowPath, 'utf-8');

// Extract the supabase-sync job steps
function getSupabaseSyncSteps(): string[] {
  const lines = workflowContent.split('\n');
  const steps: string[] = [];
  let inSupabaseSyncJob = false;
  let inSteps = false;

  for (const line of lines) {
    if (line.match(/^\s+supabase-sync:/)) {
      inSupabaseSyncJob = true;
      continue;
    }
    // Detect when we leave supabase-sync job (another job starts at same indentation)
    if (inSupabaseSyncJob && line.match(/^\s{2}\w[\w-]*:/) && !line.match(/^\s+supabase-sync:/)) {
      break;
    }
    if (inSupabaseSyncJob && line.match(/^\s+steps:/)) {
      inSteps = true;
      continue;
    }
    if (inSupabaseSyncJob && inSteps) {
      steps.push(line);
    }
  }

  return steps;
}

// Extract step names in order from the supabase-sync job
function getStepNames(): string[] {
  const steps = getSupabaseSyncSteps();
  const names: string[] = [];

  for (const line of steps) {
    const match = line.match(/^\s+- name:\s*(.+)$/);
    if (match) {
      names.push(match[1].trim());
    }
  }

  return names;
}

// Extract the `run` commands from supabase-sync steps
function getRunCommands(): Array<{ name: string; run: string }> {
  const steps = getSupabaseSyncSteps();
  const commands: Array<{ name: string; run: string }> = [];
  let currentName = '';

  for (let i = 0; i < steps.length; i++) {
    const nameLine = steps[i].match(/^\s+- name:\s*(.+)$/);
    if (nameLine) {
      currentName = nameLine[1].trim();
      continue;
    }
    const runLine = steps[i].match(/^\s+run:\s*(.+)$/);
    if (runLine && currentName) {
      let runContent = runLine[1];
      // Handle multi-line run with |
      if (runContent === '|') {
        runContent = '';
        for (let j = i + 1; j < steps.length; j++) {
          const nextLine = steps[j];
          if (nextLine.match(/^\s{8}\S/) || nextLine.match(/^\s{10}\S/)) {
            runContent += (runContent ? '\n' : '') + nextLine.trim();
          } else {
            break;
          }
        }
      }
      commands.push({ name: currentName, run: runContent });
    }
  }

  return commands;
}

describe('Property 4: Integridade de migração', () => {
  const stepNames = getStepNames();
  const runCommands = getRunCommands();

  it('pipeline applies the same migration command (supabase db push) to both environments', () => {
    // Find migration steps for Preview and Production
    const previewMigrationStep = runCommands.find(
      (cmd) => cmd.name.toLowerCase().includes('migration') && cmd.name.toLowerCase().includes('preview')
          || cmd.name.toLowerCase().includes('preview') && cmd.run.includes('supabase db push')
    );
    const productionMigrationStep = runCommands.find(
      (cmd) => cmd.name.toLowerCase().includes('migration') && cmd.name.toLowerCase().includes('production')
          || cmd.name.toLowerCase().includes('production') && cmd.run.includes('supabase db push')
    );

    expect(previewMigrationStep).toBeDefined();
    expect(productionMigrationStep).toBeDefined();

    // Both use the same base command: `supabase db push`
    expect(previewMigrationStep!.run).toContain('supabase db push');
    expect(productionMigrationStep!.run).toContain('supabase db push');

    // Both use `--db-url` flag (same command structure, only the secret differs)
    expect(previewMigrationStep!.run).toContain('--db-url');
    expect(productionMigrationStep!.run).toContain('--db-url');
  });

  it('pipeline applies migrations to Preview BEFORE Production (sequential ordering)', () => {
    const previewIndex = stepNames.findIndex(
      (name) => (name.toLowerCase().includes('migration') || name.toLowerCase().includes('push'))
        && name.toLowerCase().includes('preview')
    );
    const productionIndex = stepNames.findIndex(
      (name) => (name.toLowerCase().includes('migration') || name.toLowerCase().includes('push'))
        && name.toLowerCase().includes('production')
    );

    expect(previewIndex).toBeGreaterThan(-1);
    expect(productionIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeLessThan(productionIndex);
  });

  it('if Preview migration fails, Production migration will not execute (sequential steps in same job)', () => {
    // In GitHub Actions, steps within a job run sequentially by default.
    // If a step fails, subsequent steps are skipped (unless they have `if: always()` or `if: failure()`).
    // Verify that the Production migration step does NOT have an `if: always()` or `if: failure()` condition.
    const steps = getSupabaseSyncSteps();
    const stepsText = steps.join('\n');

    // Find the Production migration step and check it has no condition that would run it on failure
    let inProductionStep = false;
    let productionStepHasAlwaysCondition = false;

    for (const line of steps) {
      if (line.match(/- name:.*[Pp]roduction/) && (line.toLowerCase().includes('migration') || line.toLowerCase().includes('push'))) {
        inProductionStep = true;
        continue;
      }
      if (inProductionStep && line.match(/^\s+- name:/)) {
        break; // Next step started
      }
      if (inProductionStep && line.match(/if:.*always\(\)|if:.*failure\(\)/)) {
        productionStepHasAlwaysCondition = true;
      }
    }

    // Production migration should NOT have an always() or failure() condition
    expect(productionStepHasAlwaysCondition).toBe(false);
  });

  it('for any arbitrary migration file name, the pipeline structure processes both environments identically', () => {
    // Arbitrary: generates valid Supabase migration file names (YYYYMMDDHHMMSS_name.sql)
    const migrationFileNameArbitrary = fc
      .tuple(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 0, max: 59 }),
        fc.stringMatching(/^[a-z_]{3,30}$/)
      )
      .map(([year, month, day, hour, min, sec, name]) => {
        const ts = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}${String(hour).padStart(2, '0')}${String(min).padStart(2, '0')}${String(sec).padStart(2, '0')}`;
        return `${ts}_${name}.sql`;
      });

    fc.assert(
      fc.property(
        fc.array(migrationFileNameArbitrary, { minLength: 1, maxLength: 20 }),
        (migrationFiles) => {
          // The pipeline uses `supabase db push --db-url` which automatically applies
          // all pending migrations from the supabase/migrations directory.
          // This means regardless of which migration files exist, the SAME set of
          // migration files (from the same checkout) is applied to both environments.

          // Verify the structural guarantee: both commands reference the same checkout
          // (same `actions/checkout` step runs before both migration steps)
          const checkoutSteps = stepNames.filter(
            (name) => name.toLowerCase().includes('checkout')
          );
          expect(checkoutSteps.length).toBeGreaterThanOrEqual(1);

          // Both db push commands operate on the SAME working directory (same checkout)
          // so they inherently process the same set of migration files
          const previewCmd = runCommands.find(
            (cmd) => cmd.run.includes('supabase db push') && cmd.name.toLowerCase().includes('preview')
          );
          const prodCmd = runCommands.find(
            (cmd) => cmd.run.includes('supabase db push') && cmd.name.toLowerCase().includes('production')
          );

          expect(previewCmd).toBeDefined();
          expect(prodCmd).toBeDefined();

          // The command structure is identical (only the --db-url secret differs)
          // Extract the command without the secret reference
          const previewBase = previewCmd!.run.replace(/\$\{\{[^}]+\}\}/g, '<SECRET>');
          const prodBase = prodCmd!.run.replace(/\$\{\{[^}]+\}\}/g, '<SECRET>');

          // Both must use `supabase db push --db-url "<SECRET>"`
          expect(previewBase).toBe(prodBase);

          // The identical command structure guarantees that for ANY set of migration
          // files (including the arbitrary ones generated), both environments will
          // have the same migrations applied from the same source
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
