import { test, expect } from "../fixtures/dev-auth.fixture"
import { OrdersPage } from "../pages/orders.page"

type SeedOrderState = {
  id: string
  paymentStatus: "pending" | "paid"
  status: "pending" | "processing" | "shipped" | "delivered"
  totalAmount: number
  productId?: string
  productName?: string
}

type MockShipment = {
  shipmentStatus: "created" | "pending" | "skipped" | "failed"
  trackingUrl?: string
  awbCode?: string
  externalStatus?: string
}

function buildSeedOrder(input: SeedOrderState) {
  const now = new Date().toISOString()
  return {
    id: input.id,
    userId: "dev-customer-user",
    items: [
      {
        productId: input.productId ?? "garam-masala-premium",
        productName: input.productName ?? "Mix Masala Premium Blend",
        quantity: 1,
        grams: 50,
        pricePerUnit: input.totalAmount,
      },
    ],
    customer: {
      name: "Dev Customer",
      email: "dev-customer@sukhdevialchemy.local",
      phone: "+918888888888",
      address: "Test Address 1",
      city: "Bengaluru",
      pincode: "560001",
      country: "India",
    },
    subtotalAmount: input.totalAmount,
    shippingAmount: 0,
    discountAmount: 0,
    totalAmount: input.totalAmount,
    paymentStatus: input.paymentStatus,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  }
}

async function seedOrdersAndOpenTracking(params: {
  page: Parameters<typeof test>[0]["page"]
  runId: string
  scenario: string
  orders: Array<ReturnType<typeof buildSeedOrder>>
  mockShipment?: MockShipment
}) {
  const { page, runId, scenario, orders, mockShipment } = params

  await page.context().clearCookies()
  await page.addInitScript(
    ({ seededOrders }) => {
      localStorage.setItem("orders", JSON.stringify(seededOrders))
      localStorage.setItem("cart", JSON.stringify([]))
    },
    { seededOrders: orders }
  )

  if (mockShipment) {
    await page.route("**/rest/v1/order_shipments*", async (route) => {
      const shipmentPayload = {
        order_id: orders[0].id,
        provider_key: "shiprocket",
        shipment_status: mockShipment.shipmentStatus,
        shipment_id: `mock_shipment_${orders[0].id}`,
        awb_code: mockShipment.awbCode ?? "MOCKAWB123",
        tracking_url: mockShipment.trackingUrl ?? "https://mock-shiprocket.local/track/mock",
        error_message: null,
        external_status: mockShipment.externalStatus ?? null,
        external_event_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(shipmentPayload),
      })
    })
  }

  const search = new URLSearchParams({
    mode: "dev",
    devAuth: "customer",
    devView: "tracking",
    e2eRunId: runId,
    e2eScenario: scenario,
  })

  await page.goto(`/?${search.toString()}`)
}

test.describe("Order flow status simulations (Phase 4)", () => {
  // Scenario 8: pending payment case.
  test("shows pending payment state and continue payment CTA", async ({ page, testRun }) => {
    await seedOrdersAndOpenTracking({
      page,
      runId: testRun.runId,
      scenario: "pending-payment",
      orders: [buildSeedOrder({ id: "ORD-E2E-PENDING", paymentStatus: "pending", status: "pending", totalAmount: 210 })],
    })

    const ordersPage = new OrdersPage(page)
    await ordersPage.expectLoaded()

    await expect(page.getByText(/awaiting payment/i)).toBeVisible()
    await expect(page.getByText(/complete payment to start shipment processing/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /continue payment/i })).toBeVisible()
  })

  // Scenario 9: payment done, shipping pending.
  test("shows paid processing state before shipment is dispatched", async ({ page, testRun }) => {
    await seedOrdersAndOpenTracking({
      page,
      runId: testRun.runId,
      scenario: "paid-shipping-pending",
      orders: [buildSeedOrder({ id: "ORD-E2E-PROCESSING", paymentStatus: "paid", status: "processing", totalAmount: 210 })],
    })

    await expect(page.getByText(/order confirmed/i)).toBeVisible()
    await expect(page.getByText(/being prepared for shipment/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /track package/i })).toBeVisible()
  })

  // Scenarios 10 and 11: shipping assigned / in-transit via mocked shipment details.
  test("shows assigned or in-transit shipment details and tracking link", async ({ page, testRun }) => {
    await seedOrdersAndOpenTracking({
      page,
      runId: testRun.runId,
      scenario: "shipping-assigned-in-transit",
      orders: [buildSeedOrder({ id: "ORD-E2E-SHIPPING", paymentStatus: "paid", status: "shipped", totalAmount: 210 })],
      mockShipment: {
        shipmentStatus: "created",
        trackingUrl: "https://mock-shiprocket.local/track/ORD-E2E-SHIPPING",
        externalStatus: "in_transit",
      },
    })

    await expect(page.getByText(/shipped and on the way/i)).toBeVisible()
    await expect(page.getByText(/shiprocket \| created/i)).toBeVisible()
    await expect(page.getByRole("link", { name: /open tracking link/i })).toHaveAttribute(
      "href",
      /mock-shiprocket\.local\/track\/ORD-E2E-SHIPPING/
    )
  })

  // Scenario 12 and 13: shipped/delivered + order again action.
  test("shows delivered order history and enables buy again", async ({ page, testRun }) => {
    await seedOrdersAndOpenTracking({
      page,
      runId: testRun.runId,
      scenario: "delivered-order-again",
      orders: [buildSeedOrder({ id: "ORD-E2E-DELIVERED", paymentStatus: "paid", status: "delivered", totalAmount: 210 })],
    })

    await expect(page.getByText(/delivered/i).first()).toBeVisible()
    await expect(page.getByRole("button", { name: /^buy it again$/i }).first()).toBeEnabled()
  })

  // Scenario 14: payment failed represented as unpaid pending in UI.
  test("shows failed payment simulation as pending/unpaid order", async ({ page, testRun }) => {
    await seedOrdersAndOpenTracking({
      page,
      runId: testRun.runId,
      scenario: "payment-failed",
      orders: [buildSeedOrder({ id: "ORD-E2E-FAILED", paymentStatus: "pending", status: "pending", totalAmount: 210 })],
    })

    await expect(page.getByText(/awaiting payment/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /continue payment/i })).toBeVisible()
  })

  // Scenario 15: failed then reverted/recovered -> paid processing.
  test("shows recovered payment simulation as paid processing order", async ({ page, testRun }) => {
    await seedOrdersAndOpenTracking({
      page,
      runId: testRun.runId,
      scenario: "payment-reverted-recovered",
      orders: [buildSeedOrder({ id: "ORD-E2E-RECOVERED", paymentStatus: "paid", status: "processing", totalAmount: 210 })],
    })

    await expect(page.getByText(/order confirmed/i)).toBeVisible()
    await expect(page.getByRole("button", { name: /track package/i })).toBeVisible()
    await expect(page.getByRole("button", { name: /continue payment/i })).toHaveCount(0)
  })
})
