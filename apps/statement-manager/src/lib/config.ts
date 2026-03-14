export const config = {
  wipHost: import.meta.env.VITE_WIP_HOST || '',
  wipApiKey: import.meta.env.VITE_WIP_API_KEY || '',
  basePath: import.meta.env.VITE_BASE_PATH || '/',
} as const
