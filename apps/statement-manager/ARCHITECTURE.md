# Architecture

## Page/route structure

All routes are nested under a shared `Layout` component (sidebar + top bar + breadcrumb):

```
/                 DashboardPage    -- stat cards + recent transactions
/accounts         AccountsPage     -- account cards + create form
/transactions     TransactionsPage -- server-filtered table with pagination
/payslips         PayslipsPage     -- expandable payslip cards
/import           ImportPage       -- upload zone + format detection + preview + history
```

Routes are defined in `App.tsx`. The `Layout` component (`components/Layout.tsx`) provides:
- Top bar: app name, breadcrumb, portal home link
- Sidebar: nav links with active state highlighting (responsive, collapsible on mobile)
- Content area: `<Outlet />` renders the active page

## Component hierarchy

```
main.tsx
  QueryClientProvider
    WipProvider (creates @wip/client instance)
      BrowserRouter (basename from config)
        App.tsx
          Layout
            DashboardPage
            AccountsPage
              AccountCard
              AccountForm
                TermSelect
            TransactionsPage
              ColumnFilterPopover
              ColumnSelector
            PayslipsPage
              PayslipCard
                PayslipLineItems
            ImportPage
              TransactionPreview (UBS CSV + Yuh PDF)
              PayslipPreview (employer payslip)
              ReceiptScanPreview (scanned paper receipts via Tesseract.js OCR)
              ImportHistoryItem
              AccountSelector
              ImportResult
```

## Data flow

1. **WIP connection** -- `main.tsx` creates a `WipClient` from env vars and wraps the app in `WipProvider` + `QueryClientProvider`
2. **Data fetching** -- pages use `@wip/react` hooks:
   - `useDocuments({ template_value, ... })` for list views (accounts, payslips, imports) -- uses GET `/documents`
   - `useQueryDocuments({ template_id, filters, ... })` for the transactions page -- uses POST `/documents/query` with `QueryFilter[]`
   - `useTemplateByValue(code)` to resolve template IDs
   - `useTerminologies` + `useTerms` for terminology dropdowns (`TermSelect`)
3. **Mutations** -- `useCreateDocument`, `useCreateDocuments` (bulk), `useUploadFile` for import flows
4. **Caching** -- TanStack Query with 30s stale time, 2 retries

## State management

| State | Where | Why |
|-------|-------|-----|
| Filter values (search, date, account, type) | `useState` in TransactionsPage | Drives WIP query filters; reset on clear |
| Column filters | `useState<Record<string, ColumnFilter>>` | Per-column operator+value pairs, converted to `QueryFilter[]` |
| Column visibility | `useState<ColumnDef[]>` | User toggles which columns are shown |
| Page number | `useState` in TransactionsPage | Server-side pagination |
| Parsed file data | `useState<ParsedResult>` in ImportPage | Holds parsed data between upload and import confirmation |
| Sidebar open | `useState` in Layout | Mobile sidebar toggle |
| WIP data | TanStack Query cache | All WIP data lives in the query cache, never in local state |

No global state management (no Redux, no Zustand). All persistent data is in WIP.

## Key decisions and rationale

### Two-layer transaction filtering
The transactions page has both quick filters (top bar: search, dates, account, type) and column-level filter popovers (click the filter icon on any column header). Both layers produce `QueryFilter[]` arrays that are combined with AND logic and sent to WIP's `queryDocuments` endpoint. This was a deliberate design choice -- quick filters for the most common operations, column filters for power users who need operators like "greater than" or "is empty".

### Content-based PDF detection
PDFs are detected by content, not filename. After extracting text with pdfjs-dist, `detectPdfType()` checks for signature strings: "Kontoauszug in" for Yuh, "Employee Nr." / "Pay date" / "Earnings" for employer. This is more reliable than filename patterns since filenames vary.

### pdfjs-dist for PDF extraction
The app uses `pdfjs-dist` (the standard build with web worker) for browser-side PDF text extraction. The legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) is used in Node.js integration tests. Both builds produce identical text output. The shared helper `pdf-extract.ts` reconstructs lines by grouping text items by Y-position.

### Server-side filtering only
All transaction filtering uses WIP's `queryDocuments` with `QueryFilter[]`. No client-side filtering. This was a lesson from Day 1 -- client-side filtering works with 5 test records but breaks with 500 real ones.

### Import preview before commit
The import flow always shows a preview (parsed transactions or payslip line items) before creating WIP documents. The user must select/confirm the target account and explicitly click "Import". Original files are uploaded to WIP and linked via FIN_IMPORT records.

### ArrayBuffer cloning
pdfjs-dist's `getDocument()` detaches the ArrayBuffer on first use. The import flow clones buffers with `.slice(0)` before each call (once for content detection, once for parsing).

## Import parsers

Four parsers in `src/lib/parsers/`:

| Parser | File | Input | Output |
|--------|------|-------|--------|
| UBS CSV | `ubs-csv.ts` | UBS e-banking CSV export (`;`-delimited) | `ParsedUbsCsv` with header + transactions |
| Yuh PDF | `yuh-pdf.ts` | Yuh account statement PDF | `ParsedYuhPdf` with header + transactions |
| employer payslip | `employer-payslip.ts` | employer payslip PDF | `ParsedEmployerPayslip` with header + lines + summary |
| Receipt scan | `receipt-scan.ts` | JPG/PNG image of paper receipt | `ExtractedReceipt` with best-effort fields + raw OCR text |

The first three parsers are deterministic. The receipt scanner uses Tesseract.js for browser-side OCR, then regex extraction for best-effort field detection. All extracted fields are presented in an editable preview where the user corrects errors before import.

Each parser has:
- A `parse*` function that extracts structured data from the raw file
- A `toWip*` function that maps parsed data to WIP document fields (no import metadata injected)
- Unit tests with mocked PDF extraction
- Integration tests with real files using pdfjs-dist legacy build

## Container setup

Multi-stage Docker build:
1. `node:20-alpine` -- install deps, build with Vite
2. `caddy:2-alpine` -- serve static files with SPA fallback + `/health` endpoint on port 3001
