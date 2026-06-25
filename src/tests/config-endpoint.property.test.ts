import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from '../../api/config';

/**
 * Property 2: Idempotência do config endpoint
 * Verify that multiple calls to `/api/config` in the same environment
 * always return the same values.
 *
 * **Validates: Requirements 1.3, 9.2**
 */

// --- Mock helpers for VercelRequest and VercelResponse ---

function createMockRequest(): VercelRequest {
  return {} as VercelRequest;
}

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}

function createMockResponse(): { res: VercelResponse; getResult: () => MockResponse } {
  const result: MockResponse = {
    statusCode: 0,
    headers: {},
    body: null,
  };

  const res = {
    setHeader(name: string, value: string) {
      result.headers[name] = value;
      return res;
    },
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    json(data: unknown) {
      result.body = data;
      return res;
    },
  } as unknown as VercelResponse;

  return { res, getResult: () => result };
}

// --- Arbitraries ---

// Generates valid Supabase-style URLs
const supabaseUrlArbitrary = fc
  .stringMatching(/^[a-z]{3,20}$/)
  .map((projectId) => `https://${projectId}.supabase.co`);

// Generates valid publishable keys
const supabaseKeyArbitrary = fc
  .stringMatching(/^[a-zA-Z0-9]{10,40}$/)
  .map((key) => `sb_publishable_${key}`);

// Generates valid project IDs
const supabaseProjectIdArbitrary = fc.stringMatching(/^[a-z0-9]{5,20}$/);

// Combined arbitrary for env config values
const envConfigArbitrary = fc.record({
  supabaseUrl: supabaseUrlArbitrary,
  supabasePublishableKey: supabaseKeyArbitrary,
  supabaseProjectId: supabaseProjectIdArbitrary,
});

// Arbitrary for number of calls (at least 2 to verify idempotency)
const callCountArbitrary = fc.integer({ min: 2, max: 10 });

describe('Property 2: Idempotência do config endpoint', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('multiple calls to the config handler with the same env always return identical values', () => {
    fc.assert(
      fc.property(envConfigArbitrary, callCountArbitrary, (envConfig, callCount) => {
        // Set process.env with the generated values
        process.env.SUPABASE_URL = envConfig.supabaseUrl;
        process.env.SUPABASE_PUBLISHABLE_KEY = envConfig.supabasePublishableKey;
        process.env.SUPABASE_PROJECT_ID = envConfig.supabaseProjectId;

        // Call the handler multiple times and collect results
        const results: MockResponse[] = [];

        for (let i = 0; i < callCount; i++) {
          const req = createMockRequest();
          const { res, getResult } = createMockResponse();
          handler(req, res);
          results.push(getResult());
        }

        // All results must be identical
        const firstResult = results[0];

        for (let i = 1; i < results.length; i++) {
          expect(results[i].statusCode).toBe(firstResult.statusCode);
          expect(results[i].body).toEqual(firstResult.body);
        }

        // Verify the returned values match the env vars we set
        expect(firstResult.statusCode).toBe(200);
        expect(firstResult.body).toEqual({
          supabaseUrl: envConfig.supabaseUrl,
          supabasePublishableKey: envConfig.supabasePublishableKey,
          supabaseProjectId: envConfig.supabaseProjectId,
        });
      }),
      { numRuns: 100 }
    );
  });

  it('the config endpoint returns deterministic output — same env produces same response regardless of call order', () => {
    fc.assert(
      fc.property(envConfigArbitrary, (envConfig) => {
        // Set env
        process.env.SUPABASE_URL = envConfig.supabaseUrl;
        process.env.SUPABASE_PUBLISHABLE_KEY = envConfig.supabasePublishableKey;
        process.env.SUPABASE_PROJECT_ID = envConfig.supabaseProjectId;

        // First call
        const req1 = createMockRequest();
        const { res: res1, getResult: getResult1 } = createMockResponse();
        handler(req1, res1);

        // Second call
        const req2 = createMockRequest();
        const { res: res2, getResult: getResult2 } = createMockResponse();
        handler(req2, res2);

        const result1 = getResult1();
        const result2 = getResult2();

        // Both calls must produce the same response
        expect(result1.statusCode).toBe(result2.statusCode);
        expect(result1.body).toEqual(result2.body);
        expect(result1.headers).toEqual(result2.headers);
      }),
      { numRuns: 100 }
    );
  });
});
