import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WipProvider } from '@wip/react'
import { createWipClient } from '@wip/client'
import { config } from '@/lib/config'
import App from './App'
import './index.css'

const wipClient = createWipClient({
  baseUrl: config.wipHost,
  auth: { type: 'api-key', key: config.wipApiKey },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WipProvider client={wipClient}>
        <BrowserRouter basename={config.basePath}>
          <App />
        </BrowserRouter>
      </WipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
