/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

/**
 * Property 5: Fail-safe
 * Verify that for any error response from `/api/config`, the app renders
 * error UI and never initializes a Supabase connection.
 *
 * **Validates: Requirements 9.4, 5.5**
 */

// Track calls to initializeSupabase
const initializeSupabaseMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  initializeSupabase: (...args: unknown[]) => initializeSupabaseMock(...args),
}));

// We need to mock loadConfig per-test to simulate different error scenarios
const loadConfigMock = vi.fn();

vi.mock('@/lib/config', () => ({
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
}));

// Import ConfigProvider after mocks are set up
import { ConfigProvider } from './ConfigProvider';

// --- Arbitraries for error scenarios ---

// HTTP error status codes (4xx and 5xx)
const httpErrorCodeArbitrary = fc.oneof(
  fc.integer({ min: 400, max: 499 }),
  fc.integer({ min: 500, max: 599 })
);

// Generate HTTP error scenarios
const httpErrorArbitrary = httpErrorCodeArbitrary.map((statusCode) => ({
  type: 'http-error' as const,
  statusCode,
  makeError: () => new Error(`Config fetch failed: ${statusCode}`),
}));

// Generate network error scenarios
const networkErrorArbitrary = fc
  .constantFrom(
    'Failed to fetch',
    'NetworkError when attempting to fetch resource',
    'Network request failed',
    'ERR_NETWORK',
    'ERR_CONNECTION_REFUSED',
    'ERR_NAME_NOT_RESOLVED',
    'Load failed'
  )
  .map((message) => ({
    type: 'network-error' as const,
    message,
    makeError: () => new TypeError(message),
  }));

// Generate timeout/abort error scenarios
const timeoutErrorArbitrary = fc
  .constantFrom(
    'The operation was aborted',
    'signal is aborted without reason',
    'The user aborted a request',
    'AbortError'
  )
  .map((message) => ({
    type: 'timeout-error' as const,
    message,
    makeError: () => {
      const err = new DOMException(message, 'AbortError');
      return err;
    },
  }));

// Generate invalid JSON / missing fields scenarios
const invalidConfigArbitrary = fc
  .constantFrom(
    'Invalid config: missing required fields',
    'Unexpected token < in JSON at position 0',
    'JSON.parse: unexpected character at line 1 column 1'
  )
  .map((message) => ({
    type: 'invalid-response' as const,
    message,
    makeError: () => new Error(message),
  }));

// Combined arbitrary: any error scenario
const errorScenarioArbitrary = fc.oneof(
  httpErrorArbitrary,
  networkErrorArbitrary,
  timeoutErrorArbitrary,
  invalidConfigArbitrary
);

describe('Property 5: Fail-safe', () => {
  beforeEach(() => {
    initializeSupabaseMock.mockClear();
    loadConfigMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('for any error from /api/config, error UI is shown, children are NOT rendered, and initializeSupabase is NEVER called', async () => {
    await fc.assert(
      fc.asyncProperty(errorScenarioArbitrary, async (scenario) => {
        // Reset mocks for each generated scenario
        initializeSupabaseMock.mockClear();
        loadConfigMock.mockReset();
        cleanup();

        // Configure loadConfig to reject with the generated error
        loadConfigMock.mockRejectedValue(scenario.makeError());

        const childText = 'CHILD_CONTENT_SHOULD_NOT_APPEAR';

        render(
          <ConfigProvider>
            <div>{childText}</div>
          </ConfigProvider>
        );

        // Wait for the error state to appear
        await waitFor(() => {
          expect(
            screen.getByText(/Erro ao carregar configuração/i)
          ).toBeDefined();
        });

        // Assert: children are NOT rendered
        expect(screen.queryByText(childText)).toBeNull();

        // Assert: initializeSupabase was NEVER called
        expect(initializeSupabaseMock).not.toHaveBeenCalled();
      }),
      { numRuns: 50 }
    );
  });
});
