# Known Issues

## Open Issues

### UBS counterparty name parsing broken
**Status:** known
**Severity:** medium
**Description:** UBS CSV counterparty names have trailing quotes and truncated addresses. Examples: `4125 Riehen"`, `Frau Riccarda Racine"`. The `extractCounterparty()` function splits on `;` but doesn't clean up quote artifacts from the pipe-delimited description field.
**Context:** Visible in imported transaction data. Needs investigation with real UBS CSV samples to understand the exact quoting/escaping pattern.

### Yuh account inactive in WIP
**Status:** known
**Severity:** low
**Description:** The Yuh account document has `status: "inactive"` in WIP. All Yuh transactions reference it. Attempted reactivation via `create_document` upsert returned a 500 error.
**Context:** The account still shows in the app and transactions load correctly. May cause issues if status-based filtering is applied to accounts.

### Duplicate Phase 3 test account
**Status:** known
**Severity:** cosmetic
**Description:** A test account with IBAN `CH9200293293100866400` (extra trailing 0) from Phase 3 testing is still active in WIP alongside the correct one.
**Context:** Should be deactivated or deleted in WIP. Low priority since it doesn't affect functionality.

### File picker greyed-out PDFs (macOS + Google Drive)
**Status:** wont-fix
**Severity:** low
**Description:** Some PDF files appear greyed out in the macOS file selection dialog, particularly files synced from Google Drive. The `accept=".csv,.pdf"` attribute is correct. Copying files to a local folder and re-syncing sometimes resolves it.
**Context:** This is a macOS/Google Drive interaction issue, not an app bug. Importing files directly from Google Drive (via the Finder sidebar) works. Drag-and-drop also works as a workaround.

### UBS CSV transaction types not in FIN_TRANSACTION_TYPE
**Status:** known
**Severity:** low
**Description:** The UBS CSV parser produces `CREDIT_TRANSFER`, `BANK_TRANSFER`, `INTEREST`, and `SALARY` transaction types, which are not in the FIN_TRANSACTION_TYPE terminology. These will fail WIP validation. The Yuh parser was already fixed (CREDIT_TRANSFER --> BANK_TRANSFER_IN, BANK_TRANSFER --> BANK_TRANSFER_OUT), but the UBS parser still uses the old values.
**Context:** Needs the same mapping fix applied to `ubs-csv.ts` `guessTransactionType()`.

## Deferred

### Account editing
**Status:** deferred
**Description:** Account cards are not editable. There's no edit form or update flow for existing accounts.
**Context:** Intentionally deferred from the initial build. Account data rarely changes.

### Transaction categorization
**Status:** deferred
**Description:** The `category` field on FIN_TRANSACTION exists but is never set by any parser. The FIN_TRANSACTION_CATEGORY terminology is defined but unused.
**Context:** Planned for a future iteration. Would allow users to categorize transactions (e.g., "Groceries", "Rent", "Salary") for budgeting and reporting.

### Dashboard charts
**Status:** deferred
**Description:** The dashboard shows stat cards and a recent transactions list, but no charts or graphs.
**Context:** Recharts is installed as a dependency. Planned for a future iteration with spending breakdowns, monthly trends, etc.
