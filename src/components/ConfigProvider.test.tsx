/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { ConfigProvider } from './ConfigProvider';

// Mock @/lib/config
vi.mock('@/lib/config', () => ({
  loadConfig: vi.fn(),
}));

// Mock @/integrations/supabase/client
vi.mock('@/integrations/supabase/client', () => ({
  initializeSupabase: vi.fn(),
}));

import { loadConfig } from '@/lib/config';
import { initializeSupabase } from '@/integrations/supabase/client';

const mockLoadConfig = vi.mocked(loadConfig);
const mockInitializeSupabase = vi.mocked(initializeSupabase);

describe('src/components/ConfigProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Loading state', () => {
    it('renders loading indicator while config is being fetched', () => {
      // loadConfig returns a pending promise that never resolves
      mockLoadConfig.mockReturnValue(new Promise(() => {}));

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      expect(screen.getByText('Carregando...')).toBeDefined();
      expect(screen.queryByText('App Content')).toBeNull();
    });
  });

  describe('Error state', () => {
    it('renders error message when loadConfig rejects', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Config fetch failed: 500'));

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Erro ao carregar configuração/)).toBeDefined();
      });

      expect(screen.getByText(/Config fetch failed: 500/)).toBeDefined();
      expect(screen.queryByText('App Content')).toBeNull();
    });

    it('renders fallback error message when error has no message', async () => {
      mockLoadConfig.mockRejectedValue(new Error(''));

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Erro ao carregar configuração/)).toBeDefined();
      });

      expect(screen.queryByText('App Content')).toBeNull();
    });

    it('does not call initializeSupabase when config fails to load', async () => {
      mockLoadConfig.mockRejectedValue(new Error('Network error'));

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Erro ao carregar configuração/)).toBeDefined();
      });

      expect(mockInitializeSupabase).not.toHaveBeenCalled();
    });
  });

  describe('Ready state', () => {
    const validConfig = {
      supabaseUrl: 'https://test.supabase.co',
      supabasePublishableKey: 'sb_publishable_key_123',
      supabaseProjectId: 'test-project-id',
    };

    it('renders children after successful config load', async () => {
      mockLoadConfig.mockResolvedValue(validConfig);
      mockInitializeSupabase.mockReturnValue({} as ReturnType<typeof initializeSupabase>);

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('App Content')).toBeDefined();
      });
    });

    it('calls initializeSupabase with the loaded config', async () => {
      mockLoadConfig.mockResolvedValue(validConfig);
      mockInitializeSupabase.mockReturnValue({} as ReturnType<typeof initializeSupabase>);

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(mockInitializeSupabase).toHaveBeenCalledWith(validConfig);
      });
    });

    it('does not show loading indicator after config is loaded', async () => {
      mockLoadConfig.mockResolvedValue(validConfig);
      mockInitializeSupabase.mockReturnValue({} as ReturnType<typeof initializeSupabase>);

      render(
        <ConfigProvider>
          <p>App Content</p>
        </ConfigProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('App Content')).toBeDefined();
      });

      expect(screen.queryByText('Carregando...')).toBeNull();
    });
  });
});
