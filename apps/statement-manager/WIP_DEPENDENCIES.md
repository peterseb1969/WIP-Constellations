# WIP Dependencies

This document lists all WIP terminologies, templates, and cross-references used by the Statement Manager app.

## Terminologies

| Code | Name | Used for | Created by |
|------|------|----------|------------|
| FIN_CURRENCY | Currencies | Account currency, transaction currency, payslip currency | This app |
| FIN_ACCOUNT_TYPE | Account Types | Account type dropdown (CHECKING, SAVINGS, CREDIT_CARD, SHARE_DEPOT, EMPLOYER) | This app |
| FIN_TRANSACTION_TYPE | Transaction Types | Transaction categorization (DEBIT_CARD, BANK_TRANSFER_IN, BANK_TRANSFER_OUT, etc.) | This app |
| FIN_TRANSACTION_CATEGORY | Transaction Categories | User-assigned categories (future use) | This app |
| FIN_PAYSLIP_LINE_CATEGORY | Payslip Line Categories | Payslip line categorization (BASE_SALARY, ALLOWANCE, SOCIAL_CONTRIBUTION, etc.) | This app |
| IMPORT_DOCUMENT_TYPE | Import Document Types | Import record type (BANK_STATEMENT, PAYSLIP) | This app |

## Templates

### FIN_ACCOUNT
- **Purpose:** Bank accounts, credit cards, share depots, employer records
- **Identity fields:** `iban`
- **Fields this app reads/writes:** iban, institution, account_type (term: FIN_ACCOUNT_TYPE), primary_currency (term: FIN_CURRENCY), holder_name, account_number, swift_bic, description
- **Used by:** AccountsPage (CRUD), ImportPage (account selector), TransactionsPage (filter dropdown), DashboardPage (count)

### FIN_TRANSACTION
- **Purpose:** Individual financial transactions from bank statements
- **Identity fields:** `account` + `source_reference`
- **Fields this app reads/writes:** account (ref: FIN_ACCOUNT), source_reference, booking_date, value_date, currency (term: FIN_CURRENCY), amount, balance_after, transaction_type (term: FIN_TRANSACTION_TYPE), description, counterparty_name, counterparty_address, counterparty_iban, reference_number, card_number, exchange_rate, exchange_target_currency, raw_details, category (term: FIN_TRANSACTION_CATEGORY)
- **Used by:** TransactionsPage (query + filter), DashboardPage (recent list + count), ImportPage (bulk create)

### FIN_PAYSLIP
- **Purpose:** Monthly payslip summary records
- **Identity fields:** `employer` + `period`
- **Fields this app reads/writes:** employer (ref: FIN_ACCOUNT), period, pay_date, currency (term: FIN_CURRENCY), gross, net, payment_amount, total_social_contributions, total_pension_contributions, total_deductions, employee_number, capacity_utilization, target_iban
- **Used by:** PayslipsPage (list), ImportPage (create), DashboardPage (count)

### FIN_PAYSLIP_LINE
- **Purpose:** Individual line items within a payslip
- **Identity fields:** `payslip` + `code`
- **Fields this app reads/writes:** payslip (ref: FIN_PAYSLIP), code, description, category (term: FIN_PAYSLIP_LINE_CATEGORY), amount, is_deduction, basis, rate
- **Used by:** PayslipsPage (expandable detail), ImportPage (bulk create)

### FIN_IMPORT
- **Purpose:** Import history records linking uploaded files to created documents
- **Identity fields:** `filename` + `import_date`
- **Fields this app reads/writes:** filename, file (file reference), import_date, document_type (term: IMPORT_DOCUMENT_TYPE), parser, account (ref: FIN_ACCOUNT), transactions_created, period_from, period_to, status
- **Used by:** ImportPage (history list + create), DashboardPage (last import)

## Cross-app references

Currently no cross-app references. All templates reference other templates within this constellation:

- FIN_TRANSACTION.account --> FIN_ACCOUNT
- FIN_PAYSLIP.employer --> FIN_ACCOUNT
- FIN_PAYSLIP_LINE.payslip --> FIN_PAYSLIP
- FIN_IMPORT.account --> FIN_ACCOUNT

## Seed file location

All terminologies and templates are defined in `data-model/`:
- `data-model/terminologies/` -- 6 terminology JSON files
- `data-model/templates/` -- 5 template JSON files (numbered for creation order)

## External data sources

No external APIs. All data enters via file import:
- UBS e-banking CSV exports
- Yuh account statement PDFs
- Roche payslip PDFs
