import { createWipClient } from '@wip/client'
import { config } from './config'

export const wipClient = createWipClient({
  baseUrl: config.wip.baseUrl,
  auth: {
    type: 'api-key' as const,
    key: config.wip.apiKey,
  },
})
