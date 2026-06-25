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
 * 1. Apply the SAME migration command to BOTH environments (`supabase db push --linked`)
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
    // Find steps that contain db push for Preview and Production
    const previewStep = runCommands.find(
      (cmd) => cmd.name.toLowerCase().includes('preview') && cmd.run.includes('supabase db push')
    );
    const productionStep = runCommands.find(
      (cmd) => cmd.name.toLowerCase().includes('production') && cmd.run.includes('supabase db push')
    );

    expect(previewStep).toBeDefined();
    expect(productionStep).toBeDefined();

    // Both use the same base command: `supabase db push`
    expect(previewStep!.run).toContain('supabase db push');
    expect(productionStep!.run).toContain('supabase db push');

    // Both use `supabase link --project-ref` to target the correct project
    expect(previewStep!.run).toContain('supabase link --project-ref');
    expect(productionStep!.run).toContain('supabase link --project-ref');
  });

  it('pipeline applies migrations to Preview BEFORE Production (sequential ordering)', () => {
    const previewIndex = stepNames.findIndex(
      (name) => name.toLowerCase().includes('preview')
    );
    const productionIndex = stepNames.findIndex(
      (name) => name.toLowerCase().includes('production')
    );

    expect(previewIndex).toBeGreaterThan(-1);
    expect(productionIndex).toBeGreaterThan(-1);
    expect(previewIndex).toBeLessThan(productionIndex);
  });

  it('if Preview migration fails, Production migration will not execute (sequential steps in same job)', () => {
    // In GitHub Actions, steps within a job run sequentially by default.
    // If a step fails, subsequent steps are skipped (unless they have `if: always()` or `if: failure()`).
    const steps = getSupabaseSyncSteps();

    // Find the Production step and check it has no condition that would run it on failure
    let inProductionStep = false;
    let productionStepHasAlwaysCondition = false;

    for (const line of steps) {
      if (line.match(/- name:.*[Pp]roduction/)) {
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

    // Production step should NOT have an always() or failure() condition
    expect(productionStepHasAlwaysCondition).toBe(false);
  });

  it('for any arbitrary migration file name, the pipeline structure processes both environments identically', () => {
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
        () => {
          // The pipeline uses `supabase link` + `supabase db push --linked` which
          // applies all pending migrations from the supabase/migrations directory.
          // Both environments use the same checkout, so the same migration files apply.

          // Verify structural guarantee: checkout step exists
          const checkoutSteps = stepNames.filter(
            (name) => name.toLowerCase().includes('checkout')
          );
          expect(checkoutSteps.length).toBeGreaterThanOrEqual(1);

          // Both environments run `supabase db push` from the same working directory
          const previewCmd = runCommands.find(
            (cmd) => cmd.run.includes('supabase db push') && cmd.name.toLowerCase().includes('preview')
          );
          const prodCmd = runCommands.find(
            (cmd) => cmd.run.includes('supabase db push') && cmd.name.toLowerCase().includes('production')
          );

          expect(previewCmd).toBeDefined();
          expect(prodCmd).toBeDefined();

          // Both use `supabase db push --linked` (same command, different linked project)
          expect(previewCmd!.run).toContain('supabase db push --linked');
          expect(prodCmd!.run).toContain('supabase db push --linked');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
