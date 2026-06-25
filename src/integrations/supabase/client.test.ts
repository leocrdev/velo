import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppConfig } from '@/lib/config';

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

// Mock @supabase/supabase-js before importing the module under test
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getSession: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  })),
}));

import { createClient } from '@supabase/supabase-js';
import {
  initializeSupabase,
  getSupabase,
  supabase,
  resetSupabase,
} from './client';

const mockConfig: AppConfig = {
  supabaseUrl: 'https://test-project.supabase.co',
  supabasePublishableKey: 'sb_publishable_test_key_123',
  supabaseProjectId: 'test-project-id',
};

describe('src/integrations/supabase/client', () => {
  beforeEach(() => {
    resetSupabase();
    vi.mocked(createClient).mockClear();
  });

  describe('getSupabase() - throws before initialization', () => {
    it('throws an error when called before initializeSupabase()', () => {
      expect(() => getSupabase()).toThrow(
        'Supabase client not initialized. Call initializeSupabase() first.'
      );
    });
  });

  describe('initializeSupabase() - creates a valid client', () => {
    it('calls createClient with the config URL and publishable key', () => {
      initializeSupabase(mockConfig);

      expect(createClient).toHaveBeenCalledWith(
        mockConfig.supabaseUrl,
        mockConfig.supabasePublishableKey,
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: true,
            autoRefreshToken: true,
          }),
        })
      );
    });

    it('returns a client instance', () => {
      const client = initializeSupabase(mockConfig);

      expect(client).toBeDefined();
      expect(client).toHaveProperty('auth');
      expect(client).toHaveProperty('from');
    });

    it('makes client accessible via getSupabase() after initialization', () => {
      const client = initializeSupabase(mockConfig);

      expect(getSupabase()).toBe(client);
    });
  });

  describe('Proxy export - delegates to initialized instance', () => {
    it('throws when accessing proxy properties before initialization', () => {
      expect(() => supabase.auth).toThrow(
        'Supabase client not initialized. Call initializeSupabase() first.'
      );
    });

    it('delegates property access to the initialized instance', () => {
      const client = initializeSupabase(mockConfig);

      expect(supabase.auth).toBe(client.auth);
      expect(supabase.from).toBe(client.from);
    });
  });

  describe('initializeSupabase() - idempotency', () => {
    it('returns the same instance on second call (does not create a new client)', () => {
      const first = initializeSupabase(mockConfig);

      const differentConfig: AppConfig = {
        supabaseUrl: 'https://other-project.supabase.co',
        supabasePublishableKey: 'sb_publishable_other_key_456',
        supabaseProjectId: 'other-project-id',
      };
      const second = initializeSupabase(differentConfig);

      expect(first).toBe(second);
      expect(createClient).toHaveBeenCalledTimes(1);
    });
  });
});
