import { expect, test as base, type Page } from "@playwright/test"
import { createTestRunMeta, type TestRunMeta } from "../utils/test-run"

export type DevAuthRole = "customer" | "admin"
export type DevAuthView = "store" | "tracking" | "admin" | "checkout" | "account-details"

type DevAuthHelpers = {
  clearClientState: () => Promise<void>
  gotoAs: (role: DevAuthRole, view?: DevAuthView) => Promise<void>
  gotoCustomerOrders: () => Promise<void>
  gotoAdminPanel: () => Promise<void>
}

type E2EFixtures = {
  testRun: TestRunMeta
  devAuth: DevAuthHelpers
}

async function clearClientState(page: Page) {
  await page.context().clearCookies()
  await page.goto("/")
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

export const test = base.extend<E2EFixtures>({
  testRun: async ({}, use, testInfo) => {
    await use(createTestRunMeta({ title: testInfo.title, suite: "order-flow" }))
  },
  devAuth: async ({ page, testRun }, use) => {
    const buildDevUrl = (role: DevAuthRole, view: DevAuthView) => {
      const params = new URLSearchParams({
        mode: "dev",
        devAuth: role,
        devView: view,
        e2eRunId: testRun.runId,
        e2eScenario: testRun.scenario,
      })

      return `/?${params.toString()}`
    }

    const helpers: DevAuthHelpers = {
      clearClientState: () => clearClientState(page),
      gotoAs: async (role, view = "store") => {
        await clearClientState(page)
        await page.goto(buildDevUrl(role, view))
      },
      gotoCustomerOrders: async () => {
        await clearClientState(page)
        await page.goto(buildDevUrl("customer", "tracking"))
      },
      gotoAdminPanel: async () => {
        await clearClientState(page)
        await page.goto(buildDevUrl("admin", "admin"))
      },
    }

    await use(helpers)
  },
})

export { expect }
