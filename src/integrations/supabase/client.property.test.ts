import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { AppConfig } from '@/lib/config';

/**
 * Property 1: Isolamento de dados
 * Verify that given a config with a specific `supabaseUrl`, all Supabase client
 * calls target that URL exclusively.
 *
 * **Validates: Requirements 1.1, 1.2, 2.4**
 */

// Stub localStorage for Node.js test environment
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Track createClient calls to verify the URL passed
const createClientCalls: Array<{ url: string; key: string }> = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url: string, key: string) => {
    createClientCalls.push({ url, key });
    return {
      auth: { getSession: vi.fn() },
      from: vi.fn(),
      rpc: vi.fn(),
      supabaseUrl: url,
      supabaseKey: key,
    };
  }),
}));

import { initializeSupabase, resetSupabase } from './client';

// Arbitrary: generates valid Supabase-style URLs with random project IDs
const supabaseUrlArbitrary = fc
  .stringMatching(/^[a-z]{3,20}$/)
  .map((projectId) => `https://${projectId}.supabase.co`);

// Arbitrary: generates valid publishable keys
const supabaseKeyArbitrary = fc
  .stringMatching(/^[a-zA-Z0-9]{10,40}$/)
  .map((key) => `sb_publishable_${key}`);

// Arbitrary: generates valid project IDs
const supabaseProjectIdArbitrary = fc.stringMatching(/^[a-z0-9]{5,20}$/);

// Arbitrary: generates a full AppConfig
const appConfigArbitrary = fc
  .tuple(supabaseUrlArbitrary, supabaseKeyArbitrary, supabaseProjectIdArbitrary)
  .map(([supabaseUrl, supabasePublishableKey, supabaseProjectId]): AppConfig => ({
    supabaseUrl,
    supabasePublishableKey,
    supabaseProjectId,
  }));

describe('Property 1: Isolamento de dados', () => {
  beforeEach(() => {
    resetSupabase();
    createClientCalls.length = 0;
  });

  it('the Supabase client is always initialized with the exact URL from config', () => {
    fc.assert(
      fc.property(appConfigArbitrary, (config) => {
        // Reset state for each generated input
        resetSupabase();
        createClientCalls.length = 0;

        // Initialize Supabase with the generated config
        initializeSupabase(config);

        // Verify createClient was called with the exact URL from config
        expect(createClientCalls).toHaveLength(1);
        expect(createClientCalls[0].url).toBe(config.supabaseUrl);
        expect(createClientCalls[0].key).toBe(config.supabasePublishableKey);
      }),
      { numRuns: 100 }
    );
  });

  it('the initialized client never targets a different URL than the one provided in config', () => {
    fc.assert(
      fc.property(
        appConfigArbitrary,
        supabaseUrlArbitrary,
        (config, otherUrl) => {
          // Skip when URLs happen to be the same
          fc.pre(config.supabaseUrl !== otherUrl);

          // Reset state for each generated input
          resetSupabase();
          createClientCalls.length = 0;

          // Initialize with the provided config
          initializeSupabase(config);

          // The URL passed to createClient must be exactly the config URL, never any other
          expect(createClientCalls[0].url).toBe(config.supabaseUrl);
          expect(createClientCalls[0].url).not.toBe(otherUrl);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('idempotency preserves the original URL — subsequent calls with different configs do not change the target', () => {
    fc.assert(
      fc.property(
        appConfigArbitrary,
        appConfigArbitrary,
        (config1, config2) => {
          // Ensure the two configs have different URLs
          fc.pre(config1.supabaseUrl !== config2.supabaseUrl);

          // Reset state for each generated input
          resetSupabase();
          createClientCalls.length = 0;

          // Initialize with first config
          initializeSupabase(config1);

          // Attempt to initialize with second config (should be ignored)
          initializeSupabase(config2);

          // createClient should only have been called once, with the first URL
          expect(createClientCalls).toHaveLength(1);
          expect(createClientCalls[0].url).toBe(config1.supabaseUrl);
          expect(createClientCalls[0].url).not.toBe(config2.supabaseUrl);
        }
      ),
      { numRuns: 100 }
    );
  });
});
