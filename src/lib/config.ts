export interface AppConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseProjectId: string;
}

let cachedConfig: AppConfig | null = null;

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch('/api/config', { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Config fetch failed: ${response.status}`);
    }

    const config = await response.json();

    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      throw new Error('Invalid config: missing required fields');
    }

    cachedConfig = config;
    return config;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getConfig(): AppConfig | null {
  return cachedConfig;
}

/** @internal Reset cached config — for testing only */
export function resetConfig(): void {
  cachedConfig = null;
}
