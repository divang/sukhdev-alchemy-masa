export type E2ESuite = "order-flow" | "auth-flow" | "product-flow" | "admin-flow"

export type TestRunMeta = {
  runId: string
  scenario: string
  suite: E2ESuite
  createdBy: "playwright"
}

type CreateTestRunMetaInput = {
  title: string
  suite?: E2ESuite
}

function sanitizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

function compactIsoTimestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}z$/i, "z")
}

export function createTestRunMeta(input: CreateTestRunMetaInput): TestRunMeta {
  const suite = input.suite ?? "order-flow"
  const scenario = sanitizeSlug(input.title || "scenario")
  const timeToken = compactIsoTimestamp(new Date())
  const randomToken = Math.random().toString(36).slice(2, 8)
  const runId = `e2e-${suite}-${timeToken}-${randomToken}`

  return {
    runId,
    scenario,
    suite,
    createdBy: "playwright",
  }
}
