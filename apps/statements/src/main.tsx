import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WipProvider } from '@wip/react'
import { wipClient } from './lib/wip'
import { config } from './lib/config'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={config.basePath}>
      <QueryClientProvider client={queryClient}>
        <WipProvider client={wipClient}>
          <App />
        </WipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
