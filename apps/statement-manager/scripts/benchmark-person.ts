#!/usr/bin/env npx tsx
/**
 * Benchmark: PERSON document creation via @wip/client
 * Apples-to-apples comparison with Python seed script.
 */
import { createWipClient } from '@wip/client'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const client = createWipClient({
  baseUrl: 'http://localhost:8004',
  auth: { type: 'api-key', key: 'dev_master_key_for_testing' },
})
const gwClient = createWipClient({
  baseUrl: 'https://localhost:8443',
  auth: { type: 'api-key', key: 'dev_master_key_for_testing' },
})

async function run() {
  const tmpl = await gwClient.templates.getTemplateByValue('PERSON')
  const tid = tmpl.template_id
  const tv = tmpl.version
  console.log(`Template: ${tid} v${tv}`)

  const count = 500
  const batchSize = 50

  const docs = Array.from({ length: count }, (_, i) => ({
    template_id: tid,
    template_version: tv,
    namespace: 'seed',
    data: {
      first_name: `Bench${i}`,
      last_name: `Test${i}`,
      email: `bench${i}@wip-benchmark.test`,
      birth_date: '1990-01-01',
      active: true,
    },
  }))

  let totalOk = 0
  const start = performance.now()

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize)
    const bn = Math.floor(i / batchSize) + 1
    const bs = performance.now()
    const result = await client.documents.createDocuments(batch as any)
    const elapsed = performance.now() - bs
    const ok = result.results.filter((r: any) => r.status !== 'error').length
    totalOk += ok
    const serverMs = result.timing?.total
    process.stdout.write(
      `  Batch ${String(bn).padStart(3)}: ${ok} ok | ${Math.round(elapsed)}ms client` +
        (serverMs ? ` / ${Math.round(serverMs)}ms server` : '') +
        `\n`,
    )
  }

  const total = performance.now() - start
  console.log()
  console.log(`Total: ${totalOk} in ${Math.round(total)}ms = ${Math.round((count / total) * 1000)} docs/sec`)
}

run().catch((err) => {
  console.error('Failed:', err.message)
  process.exit(1)
})
