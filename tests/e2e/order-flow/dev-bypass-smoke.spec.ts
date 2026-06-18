import { AdminPage } from "../pages/admin.page"
import { OrdersPage } from "../pages/orders.page"
import { test, expect } from "../fixtures/dev-auth.fixture"

test.describe("Order flow dev bypass harness", () => {
  test("customer can open My Orders without sign-in", async ({ page, devAuth, testRun }) => {
    await devAuth.gotoCustomerOrders()

    const ordersPage = new OrdersPage(page)
    await ordersPage.expectLoaded()
    await ordersPage.expectOrderCountText()

    await expect(page).toHaveURL(/mode=dev/)
    await expect(page).toHaveURL(/devAuth=customer/)

    test.info().annotations.push({
      type: "testRun",
      description: `${testRun.runId}:${testRun.scenario}`,
    })
  })

  test("admin can open admin panel without sign-in", async ({ page, devAuth, testRun }) => {
    await devAuth.gotoAdminPanel()

    const adminPage = new AdminPage(page)
    await adminPage.expectLoaded()

    await expect(page).toHaveURL(/mode=dev/)
    await expect(page).toHaveURL(/devAuth=admin/)

    test.info().annotations.push({
      type: "testRun",
      description: `${testRun.runId}:${testRun.scenario}`,
    })
  })
})
