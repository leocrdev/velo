import { useEffect, useState, ReactNode } from 'react';
import { loadConfig } from '@/lib/config';
import { initializeSupabase } from '@/integrations/supabase/client';

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConfig()
      .then((config) => {
        initializeSupabase(config);
        setStatus('ready');
      })
      .catch((err) => {
        setError(err.message || 'Falha ao carregar configuração');
        setStatus('error');
      });
  }, []);

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-screen text-red-600">
        <p>Erro ao carregar configuração: {error}</p>
      </div>
    );
  }

  return <>{children}</>;
}
