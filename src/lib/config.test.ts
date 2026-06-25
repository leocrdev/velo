import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig, getConfig, resetConfig } from './config';

const validConfig = {
  supabaseUrl: 'https://test-project.supabase.co',
  supabasePublishableKey: 'sb_publishable_test_key_123',
  supabaseProjectId: 'test-project-id',
};

describe('src/lib/config', () => {
  beforeEach(() => {
    resetConfig();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loadConfig - successful fetch and caching', () => {
    it('fetches config from /api/config and returns it', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validConfig),
      });
      vi.stubGlobal('fetch', fetchMock);

      const config = await loadConfig();

      expect(fetchMock).toHaveBeenCalledWith('/api/config', { signal: expect.any(AbortSignal) });
      expect(config).toEqual(validConfig);
    });

    it('caches config and returns cached value on subsequent calls', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validConfig),
      });
      vi.stubGlobal('fetch', fetchMock);

      const first = await loadConfig();
      const second = await loadConfig();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });

    it('makes config available via getConfig() after successful load', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validConfig),
      }));

      expect(getConfig()).toBeNull();
      await loadConfig();
      expect(getConfig()).toEqual(validConfig);
    });
  });

  describe('loadConfig - timeout scenario', () => {
    it('aborts the request after 3 seconds', async () => {
      vi.useFakeTimers();

      const fetchMock = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      });
      vi.stubGlobal('fetch', fetchMock);

      const promise = loadConfig();
      vi.advanceTimersByTime(3000);

      await expect(promise).rejects.toThrow();
    });
  });

  describe('loadConfig - invalid response handling', () => {
    it('throws when response is not ok (e.g. status 500)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      }));

      await expect(loadConfig()).rejects.toThrow('Config fetch failed: 500');
    });

    it('throws when supabaseUrl is missing from response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          supabasePublishableKey: 'key',
          supabaseProjectId: 'id',
        }),
      }));

      await expect(loadConfig()).rejects.toThrow('Invalid config: missing required fields');
    });

    it('throws when supabasePublishableKey is missing from response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          supabaseUrl: 'https://test.supabase.co',
          supabaseProjectId: 'id',
        }),
      }));

      await expect(loadConfig()).rejects.toThrow('Invalid config: missing required fields');
    });
  });

  describe('loadConfig - network error handling', () => {
    it('throws when fetch rejects with a network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(loadConfig()).rejects.toThrow('Failed to fetch');
    });

    it('does not cache config when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(loadConfig()).rejects.toThrow();
      expect(getConfig()).toBeNull();
    });
  });
});
