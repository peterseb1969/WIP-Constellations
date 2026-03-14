# Statement Manager

A personal finance statement management app built on [WIP](https://github.com/your-org/WorldInPie). Import bank statements and payslips from Swiss financial institutions, browse transactions with advanced filtering, and track payslip breakdowns over time.

## What it does

- **Accounts** -- register bank accounts, credit cards, and employer records (with IBAN, institution, currency)
- **Transactions** -- browse and filter imported transactions with two-layer filtering: quick top-level filters (search, date range, account, type) and per-column filter popovers (contains, equals, greater than, less than, empty, not empty)
- **Payslips** -- view imported Roche payslips with expandable line item detail (earnings, deductions, social contributions, pension)
- **Import** -- upload UBS CSV exports, Yuh PDF statements, or Roche payslip PDFs; content-based format detection; preview before import; import history with original file download

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard -- stat cards (accounts, transactions, payslips, last import) + recent transactions |
| `/accounts` | Account list as cards + "Add Account" form |
| `/transactions` | Filterable table with pagination, column selector, column-level filter popovers |
| `/payslips` | Monthly payslip cards sorted by period, expandable to show line items |
| `/import` | Drag-and-drop upload zone, format auto-detection, preview, import history |

## How to run

```bash
cd apps/statement-manager
npm install
npm run dev        # starts on http://localhost:5173
npm run test       # 97 tests (5 files)
npm run build      # production build to dist/
```

## Environment variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_WIP_HOST` | WIP API gateway base URL (proxied in dev) | `http://localhost:8001` |
| `VITE_WIP_API_KEY` | WIP API key for authentication | `wip-dev-key-001` |
| `VITE_BASE_PATH` | Base path for React Router (production) | `/apps/statements` |
| `VITE_APP_PORT` | Internal port for containerized serving | `3001` |

Copy `.env.example` to `.env` and adjust as needed. In development, Vite proxies `/api/*` requests to the local WIP services (see `vite.config.ts`).

## WIP prerequisites

The following terminologies and templates must exist in WIP before the app can function. Seed files are in `data-model/`:

- **Terminologies:** FIN_CURRENCY, FIN_ACCOUNT_TYPE, FIN_TRANSACTION_TYPE, FIN_TRANSACTION_CATEGORY, FIN_PAYSLIP_LINE_CATEGORY, IMPORT_DOCUMENT_TYPE
- **Templates:** FIN_ACCOUNT, FIN_TRANSACTION, FIN_PAYSLIP, FIN_PAYSLIP_LINE, FIN_IMPORT

Use `/bootstrap` to seed a fresh WIP instance from these files.

## Tech stack

- React 19 + TypeScript (strict) + Vite 8
- Tailwind CSS for styling
- @wip/client + @wip/react for all WIP data access (TanStack Query under the hood)
- pdfjs-dist for browser-side PDF text extraction
- PapaParse for CSV parsing
- Lucide React for icons
- React Router v7 for routing
- Recharts available for future charting
- Docker (Node build + Caddy serve) for production
