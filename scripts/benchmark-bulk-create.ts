#!/usr/bin/env npx tsx
/**
 * Benchmark: bulk document creation via @wip/client
 *
 * Compares to Python seed_comprehensive.py to isolate whether
 * performance differences are in the library or the app layer.
 *
 * Usage:
 *   npx tsx scripts/benchmark-bulk-create.ts [--url URL] [--key KEY] [--count N] [--batch N]
 *
 * Defaults: localhost:8004 direct, 500 documents, batch size 50
 */

import { createWipClient } from '@wip/client'

const args = process.argv.slice(2)
function arg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
}

const baseUrl = arg('url', 'http://localhost:8004')
const apiKey = arg('key', 'dev_master_key_for_testing')
const docCount = parseInt(arg('count', '500'), 10)
const batchSize = parseInt(arg('batch', '50'), 10)

// --- Setup ---

const client = createWipClient({
  baseUrl,
  auth: { type: 'api-key', key: apiKey },
})

// Look up FIN_TRANSACTION template
async function getTemplateId(): Promise<{ id: string; version: number }> {
  // @wip/client's template service goes through /api/template-store
  // but we're hitting the document store directly — need to use template store
  // Let's use a separate client for template lookup
  const templateUrl = baseUrl.replace(':8004', ':8003')
  const tClient = createWipClient({
    baseUrl: templateUrl,
    auth: { type: 'api-key', key: apiKey },
  })
  const tmpl = await tClient.templates.getTemplateByValue('FIN_TRANSACTION')
  return { id: tmpl.template_id, version: tmpl.version }
}

// Look up a FIN_ACCOUNT document to use as reference
async function getAccountId(): Promise<string> {
  const result = await client.documents.listDocuments({
    template_value: 'FIN_TRANSACTION',
    page_size: 1,
    latest_only: true,
  })
  if (result.items.length > 0) {
    const data = result.items[0].data as Record<string, unknown>
    return data.account as string
  }
  throw new Error('No FIN_TRANSACTION documents found — need at least one to get an account reference')
}

// Generate a synthetic transaction document
function generateTransaction(
  templateId: string,
  templateVersion: number,
  accountId: string,
  index: number,
): Record<string, unknown> {
  const date = new Date(2025, 0, 1 + (index % 365))
  const dateStr = date.toISOString().slice(0, 10)
  const amount = -((index % 500) + 1) + (index % 3 === 0 ? (index % 2000) + 100 : 0)

  return {
    template_id: templateId,
    template_version: templateVersion,
    data: {
      account: accountId,
      source_reference: `BENCH-${Date.now()}-${index}`,
      booking_date: dateStr,
      value_date: dateStr,
      currency: 'CHF',
      amount,
      transaction_type: 'DEBIT_CARD',
      description: `Benchmark transaction #${index}`,
    },
  }
}

// --- Benchmark ---

async function run() {
  console.log(`Benchmark: @wip/client bulk document creation`)
  console.log(`  URL:        ${baseUrl}`)
  console.log(`  Documents:  ${docCount}`)
  console.log(`  Batch size: ${batchSize}`)
  console.log()

  // Resolve template and account
  const { id: templateId, version: templateVersion } = await getTemplateId()
  console.log(`  Template:   ${templateId} v${templateVersion}`)

  const accountId = await getAccountId()
  console.log(`  Account:    ${accountId}`)
  console.log()

  // Generate all documents
  const docs = Array.from({ length: docCount }, (_, i) =>
    generateTransaction(templateId, templateVersion, accountId, i),
  )

  // Send in batches, measure each
  const batchTimings: { batch: number; count: number; ms: number; serverMs?: number }[] = []
  let totalCreated = 0
  let totalErrors = 0

  const overallStart = performance.now()

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1

    const start = performance.now()
    const result = await client.documents.createDocuments(batch as any)
    const elapsed = performance.now() - start

    const created = result.results.filter(
      (r: any) => r.status === 'created' || r.status === 'updated' || r.status === 'unchanged',
    ).length
    const errors = result.results.filter((r: any) => r.status === 'error').length

    totalCreated += created
    totalErrors += errors

    const serverMs = result.timing?.total
    batchTimings.push({ batch: batchNum, count: batch.length, ms: Math.round(elapsed), serverMs })

    process.stdout.write(
      `  Batch ${batchNum.toString().padStart(3)}:` +
        ` ${batch.length} docs → ${created} ok, ${errors} err` +
        ` | ${Math.round(elapsed)}ms client` +
        (serverMs ? ` / ${Math.round(serverMs)}ms server` : '') +
        `\n`,
    )
  }

  const overallMs = performance.now() - overallStart

  // --- Summary ---
  console.log()
  console.log(`--- Summary ---`)
  console.log(`  Total:      ${totalCreated} created, ${totalErrors} errors`)
  console.log(`  Wall time:  ${Math.round(overallMs)}ms`)
  console.log(`  Throughput: ${Math.round((docCount / overallMs) * 1000)} docs/sec`)
  console.log()

  // Timing breakdown (skip first batch — cold cache)
  if (batchTimings.length > 1) {
    const warm = batchTimings.slice(1)
    const avgClient = warm.reduce((s, b) => s + b.ms, 0) / warm.length
    const serverTimes = warm.filter((b) => b.serverMs).map((b) => b.serverMs!)
    const avgServer = serverTimes.length > 0 ? serverTimes.reduce((s, t) => s + t, 0) / serverTimes.length : null

    console.log(`  Warm batches (excluding first):`)
    console.log(`    Avg client round-trip: ${Math.round(avgClient)}ms`)
    if (avgServer) {
      console.log(`    Avg server processing: ${Math.round(avgServer)}ms`)
      console.log(`    Avg network overhead:  ${Math.round(avgClient - avgServer)}ms`)
    }
  }

  // First batch (cold)
  if (batchTimings.length > 0) {
    const first = batchTimings[0]
    console.log(`  First batch (cold cache): ${first.ms}ms client${first.serverMs ? ` / ${Math.round(first.serverMs)}ms server` : ''}`)
  }
}

run().catch((err) => {
  console.error('Benchmark failed:', err.message)
  process.exit(1)
})
