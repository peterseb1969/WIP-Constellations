# Changelog

## 2026-03-14 -- Parser tests and documentation

- Added: Integration tests for Yuh PDF and employer payslip parsers using pdfjs-dist legacy build against real files
- Added: Unit tests for all three parsers (UBS CSV, Yuh PDF, employer payslip) -- 97 tests total
- Added: Full documentation suite (README, ARCHITECTURE, WIP_DEPENDENCIES, IMPORT_FORMATS, KNOWN_ISSUES, CHANGELOG)
- Verified: Parsers produce no import metadata (no imported_at, import_date, import_id, file_id) in WIP documents

## 2026-03-13 -- Column filtering and transaction UX

- Added: Two-layer filtering on transactions page -- top-level quick filters + per-column filter popovers
- Added: Column-level filter operators: contains, equals, greater than, less than, empty, not empty
- Added: Column selector to show/hide columns in the transactions table
- Changed: All transaction filtering uses server-side WIP `queryDocuments` with `QueryFilter[]`
- Fixed: Removed `latest_only` from queryDocuments (not supported on POST endpoint, caused 422)
- Fixed: Column filter popover layout -- vertical flex instead of horizontal

## 2026-03-12 -- PDF parser migration and import fixes

- Changed: Migrated Yuh and employer parsers from `pdf-parse` to `pdfjs-dist` via shared `pdf-extract.ts` helper
- Changed: PDF format detection from filename-based to content-based (`detectPdfType`)
- Fixed: Browser crash caused by `pdf-parse` using `fs.readFileSync` (Node-only API)
- Fixed: ArrayBuffer detachment -- clone buffer with `.slice(0)` before each pdfjs-dist call
- Fixed: Invalid FIN_TRANSACTION_TYPE values (CREDIT_TRANSFER --> BANK_TRANSFER_IN, BANK_TRANSFER --> BANK_TRANSFER_OUT) in Yuh parser
- Fixed: Duplicate version errors (E11000) now counted as successes in import flow

## 2026-03-11 -- Initial build

- Added: Dashboard page with stat cards and recent transactions
- Added: Accounts page with card view and create form
- Added: Transactions page with server-side pagination
- Added: Payslips page with expandable line item detail
- Added: Import page with drag-and-drop upload, preview, and import history
- Added: UBS CSV parser with counterparty extraction
- Added: Yuh PDF parser with sign determination and multi-currency support
- Added: employer payslip parser with category mapping and summary extraction
- Added: Shared PDF extraction helper (`pdf-extract.ts`) using pdfjs-dist
- Added: Layout with sidebar navigation, top bar, breadcrumbs
- Added: Docker multi-stage build (Node + Caddy)
- Added: App manifest for gateway registration
- Known issues: UBS counterparty parsing broken (trailing quotes)
