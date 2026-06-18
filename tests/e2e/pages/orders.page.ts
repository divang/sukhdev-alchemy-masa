import { expect, type Page } from "@playwright/test"

export class OrdersPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /your orders/i })).toBeVisible()
  }

  async expectOrderCountText() {
    await expect(this.page.getByText(/orders?$/i).first()).toBeVisible()
  }

  async searchOrders(query: string) {
    await this.page.getByRole("textbox", { name: /search all orders/i }).fill(query)
    await this.page.getByRole("button", { name: /search orders/i }).click()
  }

  async openBuyAgainTab() {
    await this.page.getByRole("button", { name: /^buy again$/i }).click()
  }

  async openNotYetShippedTab() {
    await this.page.getByRole("button", { name: /not yet shipped/i }).click()
  }
}
