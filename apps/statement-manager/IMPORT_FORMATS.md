# Import Formats

## UBS CSV (e-banking export)

- **Source:** UBS e-banking portal, "Kontoauszug" CSV export
- **File type:** CSV (`;`-delimited, UTF-8)
- **Parser:** `src/lib/parsers/ubs-csv.ts`

### Column mapping

| CSV Column | Index | WIP Field | Transformation |
|-----------|-------|-----------|----------------|
| Abschlussdatum | 0 | -- | Not mapped (closing date) |
| Abschlusszeit | 1 | -- | Not mapped |
| Buchungsdatum | 2 | `booking_date` | Direct (already YYYY-MM-DD) |
| Valutadatum | 3 | `value_date` | Direct |
| Waehrung | 4 | `currency` | Direct (CHF/EUR/USD) |
| Belastung | 5 | `amount` (if debit) | Negative number, already signed |
| Gutschrift | 6 | `amount` (if credit) | Positive number |
| Einzelbetrag | 7 | `amount` (fallback) | Used if both debit/credit are empty |
| Saldo | 8 | `balance_after` | Direct |
| Transaktions-Nr. | 9 | `source_reference` | Direct (identity field) |
| Beschreibung1 | 10 | `counterparty_name`, `counterparty_address` | Split on `;` -- first part is name, rest is address |
| Beschreibung2 | 11 | `description`, `card_number` | Card number extracted via regex; rest is description |
| Beschreibung3 | 12 | `counterparty_iban`, `reference_number`, `raw_details` | IBAN via "Konto-Nr. IBAN:" pattern; QRR reference via "Referenz-Nr. QRR:" pattern |
| Fussnoten | 13 | -- | Not mapped |

### Transaction type inference

From `Beschreibung2` (description2):
- "debitkarte" / "zahlung debitkarte" --> `DEBIT_CARD`
- "e-bill" / "ebill" --> `E_BILL`
- "dauerauftrag" --> `STANDING_ORDER`
- "gutschrift" / "e-banking-gutschrift" --> `CREDIT_TRANSFER`
- "vergutung" / "e-banking-vergutungsauftrag" --> `BANK_TRANSFER`
- "wahrung" --> `CURRENCY_EXCHANGE`
- "saldo dienstleistungspreis" (from desc1) --> `FEE`
- "zins" (from desc1) --> `INTEREST`
- "lohn" / "salar" / "gehalt" --> `SALARY`
- Fallback: `OTHER`

### File header

Lines before the column headers contain account metadata:
- `Kontonummer:` -- account number
- `IBAN:` -- account IBAN (used for auto-matching)
- `Von:` / `Bis:` -- period dates
- `Bewertet in:` -- currency
- `Anfangssaldo:` / `Schlusssaldo:` -- opening/closing balance

### Known issues

- **Counterparty names have trailing quotes and truncated addresses.** Names like `4125 Riehen"` and `Frau Riccarda Racine"` appear because the semicolon-delimited field isn't properly cleaned. See KNOWN_ISSUES.md.
- Rows without a `transactionId` or resolved amount are skipped.

### Redacted sample

```csv
Kontonummer:;0235-123456.01U1
IBAN:;CH93 0076 2011 6238 5295 7
...
Abschlussdatum;Abschlusszeit;Buchungsdatum;Valutadatum;Waehrung;Belastung;Gutschrift;Einzelbetrag;Saldo;Transaktions-Nr.;Beschreibung1;Beschreibung2;Beschreibung3;Fussnoten
2026-01-31;23:59;2026-01-15;2026-01-15;CHF;-42.80;;;1234.56;9876543210;Migros Basel;18810344-0 04/28; Zahlung Debitkarte;;
```

---

## Yuh PDF (account statement)

- **Source:** Yuh app, monthly "Kontoauszug" PDF
- **File type:** PDF
- **Parser:** `src/lib/parsers/yuh-pdf.ts`
- **Detection:** Content-based -- looks for "Kontoauszug in" in extracted text

### Field mapping

| PDF Content | WIP Field | Transformation |
|-------------|-----------|----------------|
| Transaction date (DD.MM.YYYY) | `booking_date` | Converted to YYYY-MM-DD |
| Valuta date in last line | `value_date` | Converted to YYYY-MM-DD |
| 10-digit reference in last line | `source_reference` | Direct (identity field) |
| Section header ("Kontoauszug in CHF") | `currency` | Extracted currency code |
| Amount in last line | `amount` | Signed based on saldo difference |
| Saldo in last line | `balance_after` | Direct |
| First line after date | `description` (raw type) | Direct -- also used for `transaction_type` inference |
| Card number line ("xxxx 8748") | `card_number` | Direct |
| Counterparty lines | `counterparty_name`, `counterparty_address` | First non-metadata middle line is name, rest is address |
| IBAN line | `counterparty_iban` | Direct |
| Exchange rate line | `exchange_rate`, `exchange_target_currency` | Parsed from "1 CHF = 0.9234 EUR" pattern |

### Transaction type inference

From the type line (first line of block after date):
- "Zahlung per Debitkarte" --> `DEBIT_CARD`
- "Zahlung von" --> `BANK_TRANSFER_IN`
- "Zahlung an" --> `BANK_TRANSFER_OUT`
- "Wahrungsumtausch" / "hrungsumtausch" --> `CURRENCY_EXCHANGE`
- Fallback: `OTHER`

### Sign determination

The amount in the PDF is unsigned. Sign is determined by comparing the transaction's saldo with the previous transaction's saldo. If the saldo decreased, the amount is negative. Fallback heuristics use the transaction type ("Zahlung per Debitkarte" = negative, "Zahlung von" = positive).

### Structure

Each transaction block in the PDF follows this pattern:
```
DD.MM.YYYY Transaction type description
[optional: card number "xxxx 8748"]
[optional: counterparty name]
[optional: counterparty address]
[optional: IBAN]
[optional: exchange rate "1 CHF = 0.9234 EUR"]
RRRRRRRRRR AAAA.AA DD.MM.YYYY SSSS.SS
```
Where R=reference(10), A=amount, D=valuta date, S=saldo.

### Known issues

- IBAN extraction from the header may fail in some environments due to font rendering differences in pdfjs-dist. Period dates and transactions are unaffected.
- Multi-currency accounts have separate sections per currency.

---

## Employer Payslip PDF

- **Source:** Employer HR system, monthly payslip PDF
- **File type:** PDF (bilingual English/German)
- **Parser:** `src/lib/parsers/employer-payslip.ts`
- **Detection:** Content-based -- looks for "Employee Nr." or "Pay date" or "Earnings"

### Header mapping

| PDF Content | WIP Field | Transformation |
|-------------|-----------|----------------|
| "Employee Nr. NNNNN" | `employee_number` | Regex extraction |
| "Pay date DD.MM.YYYY" | `pay_date` | Converted to YYYY-MM-DD |
| "Month YYYY" before "Pay period" | `period` | Converted to YYYY-MM |
| "NNN%" | `capacity_utilization` | Parsed as integer |

### Line item mapping

Each line item follows the pattern: `CODE Description [Basis] [Rate %] Amount[-]`

| PDF Content | WIP Field | Transformation |
|-------------|-----------|----------------|
| Code (e.g., "1001", "/411") | `code` | Direct |
| Description text | `description` | Direct |
| Trailing amount | `amount` | Always positive |
| Trailing "-" | `is_deduction` | true if present |
| Basis amount (if present) | `basis` | Parsed, null if absent |
| Rate with "%" (if present) | `rate` | Parsed as percentage (5.30, not 0.053) |
| Code-based lookup | `category` | See category mapping below |

### Category mapping (CODE_TO_CATEGORY)

| Code | Category |
|------|----------|
| 1001 | BASE_SALARY |
| 2003, 2004, 2005, 2123 | ALLOWANCE |
| 4103 | BONUS |
| 4301 | ESPP |
| 4101, 4311 | NON_CASH_BENEFIT |
| 4313 | LTI |
| /411, /420 | SOCIAL_CONTRIBUTION |
| 6103, 6104 | PENSION |
| 6106 | SUPPLEMENTARY_PENSION |
| 6108, 6109 | VOLUNTARY_SAVING |
| 6201 | BENEFIT_DEDUCTION |

Unknown codes fall back to description-based heuristics.

### Summary extraction

Summary values are derived from subtotal codes:
- `/101` = gross
- `/550` = net
- `/110` = total deductions
- "Payment Amount" line = payment amount
- Social = sum of /411 + /420
- Pension = sum of 6103 + 6104
- IBAN + currency from bank details section

Subtotal lines (/101, /550, /110) are excluded from the line items returned to the caller.

### Structure

The PDF is bilingual. The parser uses only the English section (before the "Herr"/"Frau" line that starts the German section). Within the English section:
1. Header fields (employee number, pay date, period, capacity)
2. "Earnings" section with line items
3. "Non-cash Benefits" section (if present)
4. "Bank Details" / "Payment Amount" section
5. German section (ignored)
