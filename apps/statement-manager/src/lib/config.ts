/**
 * App configuration — runtime config from /config.json (container),
 * falling back to Vite env vars (dev mode).
 */

interface AppConfig {
  wipApiUrl: string
  wipApiKey: string
  basePath: string
}

let _config: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (_config) return _config

  // In production, the entrypoint script writes /config.json from env vars.
  // In dev, this file won't exist — fall back to Vite env vars.
  try {
    const res = await fetch('/config.json')
    if (res.ok) {
      const json = await res.json()
      _config = {
        wipApiUrl: json.wipApiUrl || window.location.origin,
        wipApiKey: json.wipApiKey || '',
        basePath: json.basePath || '/',
      }
      return _config
    }
  } catch {
    // /config.json not available — dev mode
  }

  _config = {
    wipApiUrl: import.meta.env.VITE_WIP_HOST || '',
    wipApiKey: import.meta.env.VITE_WIP_API_KEY || '',
    basePath: import.meta.env.VITE_BASE_PATH || '/',
  }
  return _config
}
