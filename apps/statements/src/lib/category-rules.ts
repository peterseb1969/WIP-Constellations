/**
 * Category rule engine for bank transactions.
 *
 * Rules are currently persisted in localStorage for the MVP.
 * The interface is designed so that migrating to WIP documents
 * (once a rules template exists) requires changing only
 * loadRules / saveRules — all consumers go through matchCategory.
 */

const STORAGE_KEY = 'statements:category-rules'

export interface CategoryRule {
  id: string
  pattern: string
  category: string
  priority: number
}

/**
 * Returns the category of the highest-priority rule whose pattern
 * appears (case-insensitive) in either the description or
 * counterparty name. Returns null if no rule matches.
 */
export function matchCategory(
  description: string,
  counterpartyName: string,
  rules: CategoryRule[],
): string | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  const descLower = description.toLowerCase()
  const counterpartyLower = counterpartyName.toLowerCase()

  for (const rule of sorted) {
    const patternLower = rule.pattern.toLowerCase()
    if (descLower.includes(patternLower) || counterpartyLower.includes(patternLower)) {
      return rule.category
    }
  }

  return null
}

/** Load rules from localStorage. Returns an empty array if none exist. */
export function loadRules(): CategoryRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as CategoryRule[]
  } catch {
    return []
  }
}

/** Persist rules to localStorage. */
export function saveRules(rules: CategoryRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}
